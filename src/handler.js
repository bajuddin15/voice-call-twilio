const VoiceResponse = require("twilio").twiml.VoiceResponse;
const AccessToken = require("twilio").jwt.AccessToken;
const VoiceGrant = AccessToken.VoiceGrant;

const twilio = require("twilio");
const {
  getProviderDetails,
  getTokenFromNumber,
  addCallRecord,
  getVoiceCallMsg,
  sendMessage,
  getProfileByToken,
  createCallRecordInZoho,
  updateMessageStatusById,
  updateMessageStatusByCallId,
  createZohoIncomingCallLead,
  getMyOperatorRecordingUrl,
} = require("../utils/api");
const {
  sanitizePhoneNumber,
  extractNumberFromClient,
} = require("../utils/common");
const { BASE_URL, DEVICE_STATUS } = require("../utils/constants");
const Call = require("./models/call.models");
const TwilioAccountDetails = require("./models/twilioAccountDetails");
const CallForwarding = require("./models/callForwarding.models");
const MissedCallAction = require("./models/missedCallAction.models");
const axios = require("axios");

const tokenGenerator = async (req, res) => {
  const { devToken, providerNumber } = req.body;
  console.log({ devToken, providerNumber });

  try {
    const resProfile = await getProfileByToken(devToken);
    console.log({ resProfile });
    if (resProfile && resProfile?.status === 200) {
      const profileData = resProfile?.data;
      if (profileData && profileData?.plan === "1") {
        // it is free plan so don't make token
        return res.status(403).json({
          status: false,
          message: "Please upgrade your free plan to pro",
        });
      }
    }
    const resData = await getProviderDetails(devToken, providerNumber);
    console.log({ resData });
    if (resData && resData?.provider_number) {
      const twilioAccountDetails = {
        provider_number:
          resData?.provider_number[0] === "+"
            ? resData?.provider_number
            : `+${resData?.provider_number}`,
        account_sid: resData?.account_sid,
        twiml_app_sid: resData?.twiml_app_sid,
        twilio_api_key: resData?.twilio_api_key,
        twilio_api_secret: resData?.twilio_api_secret,
      };

      console.log({ twilioAccountDetails });

      const identity = twilioAccountDetails?.provider_number;

      console.log({ identity });

      const accessToken = new AccessToken(
        twilioAccountDetails.account_sid,
        twilioAccountDetails.twilio_api_key,
        twilioAccountDetails.twilio_api_secret
      );

      console.log({ accessToken });

      accessToken.identity = identity;

      console.log({ accessToken });
      const grant = new VoiceGrant({
        outgoingApplicationSid: twilioAccountDetails.twiml_app_sid,
        incomingAllow: true,
      });
      accessToken.addGrant(grant);

      console.log({ grant });

      const twilioDetails = await TwilioAccountDetails.findOne({
        identity: twilioAccountDetails.provider_number,
      });
      console.log({ twilioAccountDetails, identity, twilioDetails });

      if (!twilioDetails) {
        const newDetail = new TwilioAccountDetails({
          identity: identity,
          token: accessToken.toJwt(),
        });

        await newDetail.save();

        return res.status(200).json({
          success: true,
          message: "Token Generated",
          identity: newDetail?.identity,
          token: newDetail?.token,
        });
      } else {
        // if exist
        const updatedDetail = await TwilioAccountDetails.findByIdAndUpdate(
          twilioDetails._id,
          {
            identity: identity,
            token: accessToken.toJwt(),
          },
          { new: true }
        );

        return res.status(200).json({
          success: true,
          message: "Token Generated",
          identity: updatedDetail?.identity,
          token: updatedDetail?.token,
          deviceStatus: updatedDetail?.deviceStatus,
        });
      }
    } else {
      res.status(400).json({
        success: false,
        message: "Provider details not found",
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error?.message,
    });
  }
};

const voiceResponse = async (req) => {
  const { To, Provider_Number } = req.body;
  const toNumberOrClientName = To;
  const providerNumber = Provider_Number;
  const twilioAccountDetailTo = await TwilioAccountDetails.findOne({
    identity: To,
  });

  const callerId = providerNumber;
  let twiml = new VoiceResponse();

  if (!providerNumber) {
    // Incoming Call
    // This will connect the caller with your Twilio.Device/client
    const identity = twilioAccountDetailTo?.identity;
    const deviceStatus = twilioAccountDetailTo.deviceStatus;

    // check call Forwarding is on or not
    const callForwarding = await CallForwarding.findOne({
      forwardedNumber: identity,
    });

    const provider_number = sanitizePhoneNumber(identity);
    const devToken = await getTokenFromNumber(provider_number);
    const resProfile = await getProfileByToken(devToken);
    const profileData = resProfile?.data;
    if (profileData && profileData?.plan === "1") {
      // it is free plan so don't make call
      let msg =
        "Incoming calls to this number are currently unavailable. Please try again later.";
      // device INACTIVE
      twiml.say(msg);
    } else if (callForwarding?.isEnabled && callForwarding?.toPhoneNumber) {
      // forward this call
      // Add a professional message before forwarding the call
      twiml.say("Please hold. Your call is being forwarded.");

      let dial = twiml.dial({
        record: true,
        recordingStatusCallback: `${BASE_URL}/api/recordingCallback`,
      });

      // call forward
      const toPhoneNumber = callForwarding.toPhoneNumber;
      dial["number"](
        {
          statusCallback: `${BASE_URL}/api/webhook`,
          statusCallbackEvent: "completed",
        },
        toPhoneNumber
      );
    } else {
      // Call should not forward
      if (deviceStatus === DEVICE_STATUS.INACTIVE) {
        const resData = await getVoiceCallMsg(devToken);
        let msg =
          resData?.voiceMessage ||
          "We're sorry, but the person you are trying to reach is currently unavailable to take your call.";
        // device INACTIVE
        twiml.say(msg);
      } else {
        // it means device status active
        // This is an incoming call
        let dial = twiml.dial({
          record: true,
          recordingStatusCallback: `${BASE_URL}/api/recordingCallback`,
        });
        dial.client(
          {
            statusCallback: `${BASE_URL}/api/webhook`,
            statusCallbackEvent: "completed",
          },
          identity
        );
      }
    }
  } else if (To && Provider_Number) {
    // This is an outgoing call

    // set the callerId
    let dial = twiml.dial({
      callerId,
      record: true,
      recordingStatusCallback: `${BASE_URL}/api/recordingCallback`,
    });

    // Check if the 'To' parameter is a Phone Number or Client Name
    // in order to use the appropriate TwiML noun
    const attr = isAValidPhoneNumber(toNumberOrClientName)
      ? "number"
      : "client";
    dial[attr](
      {
        statusCallback: `${BASE_URL}/api/webhook`,
        statusCallbackEvent: "completed",
      },
      toNumberOrClientName
    );
  } else {
    twiml.say("Thanks for calling!");
  }

  return twiml.toString();
};

const makeOutgoingTextToSpeechCall = async (req, res) => {
  try {
    const {
      to,
      text,
      provider_number,
      account_sid,
      twiml_app_sid,
      twilio_api_key,
      twilio_api_secret,
      twilio_auth_token,
    } = req.body;

    const TWILIO_ACCOUNT_DETAIL = {
      callerId: provider_number,
      accountSid: account_sid,
      twimlAppSid: twiml_app_sid,
      apiKey: twilio_api_key,
      apiSecret: twilio_api_secret,
      authToken: twilio_auth_token,
    };

    // Create a TwiML response for the outgoing call
    const twimlResponse = new VoiceResponse();
    twimlResponse.say(text); // Convert text to speech

    let twiml = twimlResponse.toString();

    // making call and speak this twilioResp text
    const client = require("twilio")(
      TWILIO_ACCOUNT_DETAIL.accountSid,
      TWILIO_ACCOUNT_DETAIL.authToken
    );
    const call = await client.calls.create({
      twiml,
      to,
      from: TWILIO_ACCOUNT_DETAIL.callerId,
      record: true,
      recordingStatusCallback: `${BASE_URL}/api/recordingCallback`,
      statusCallback: `${BASE_URL}/api/callStatusTextToSpeech`,
    });

    // Make the API response
    res.type("text/xml");
    res.status(200).json({
      success: true,
      message: "Call is created",
      twiml,
    });
  } catch (error) {
    console.error("Error making outgoing call:", error);
    res.status(500).json({ error: "Failed to make outgoing call" });
  }
};

// recording call callback
const recordingCall = async (req, res) => {
  // const recordingUrl = req.body?.RecordingUrl;
  // const callSid = req.body?.CallSid;

  // Handle the recording URL as needed

  // Here you can save the recording URL, call SID, and duration to your database or perform any other necessary action

  res.status(200).end();
};

const callStatusTextToSpeech = async (req, res) => {
  const {
    RecordingUrl,
    To,
    From,
    CallDuration,
    CallSid,
    ParentCallSid,
    AccountSid,
  } = req.body;

  let toNumber, fromNumber, callDirection;
  if (To.startsWith("client:")) {
    toNumber = extractNumberFromClient(To);
    fromNumber = From;
    callDirection = "incoming";
  } else {
    toNumber = To;
    fromNumber = From;
    callDirection = "outgoing";
  }

  const providerNumber = sanitizePhoneNumber(
    callDirection === "outgoing" ? fromNumber : toNumber
  );

  const devToken = await getTokenFromNumber(providerNumber);
  if (!devToken) {
    return res.status(404).end();
  }

  const resData = await getProviderDetails(devToken, providerNumber);
  if (resData && resData.provider_number) {
    const TWILIO_ACCOUNT_DETAIL = {
      accountSid: AccountSid,
      authToken: resData.account_token,
    };
    const client = require("twilio")(
      TWILIO_ACCOUNT_DETAIL.accountSid,
      TWILIO_ACCOUNT_DETAIL.authToken
    );

    const fetchCallDetails = async (retryCount = 0) => {
      if (retryCount > 10) {
        // Maximum retries
        console.error("Failed to fetch call price after multiple attempts");
        return;
      }
      try {
        const call = await client.calls(CallSid).fetch();
        console.log({ findCall: call });
        let parentCall;
        if (ParentCallSid) {
          parentCall = await client.calls(ParentCallSid).fetch();
        }

        if (retryCount === 10 && !call?.price) {
          const totalPrice = "-0.1";

          const callDetails = {
            to: call.to,
            from: call.from,
            recordingUrl: RecordingUrl || "",
            callDuration: CallDuration,
            callDirection:
              call.direction === "outbound-dial" ? "outgoing" : "incoming",
            price: totalPrice,
            currency: call?.priceUnit,
            callSid: CallSid,
          };
          const newCall = new Call({
            callSid: CallSid,
            parentCallSid: ParentCallSid || "",
            accountSid: AccountSid,
            to: call.to,
            from: call.from,
            recordingUrl: RecordingUrl || "",
            duration: CallDuration,
            direction:
              call.direction === "outbound-dial" ? "outgoing" : "incoming",
            callPrice: totalPrice,
            parentCallPrice: totalPrice,
            currency: call.priceUnit,
            totalPrice: totalPrice,
          });
          await newCall.save();
          let resp;
          if (call.status === "completed") {
            resp = await addCallRecord(devToken, callDetails);
          }
          const zohoCallRecordData = {
            subject:
              call.status === "busy" || call.status === "no-answer"
                ? "Missed Call"
                : call.direction.includes("outbound")
                ? `Outgoing Call ${call.to}`
                : `Incoming Call ${call.from}`,
            callType:
              call.status === "busy" || call.status === "no-answer"
                ? "Missed"
                : call.direction.includes("outbound")
                ? "Outbound"
                : "Inbound",
            callPurpose: "Follow-up",
            callFrom: call.from,
            relatedTo: "", // zoho crm id
            callDetails: call.status,
            callStartTime: call.startTime,
            callDuration: call.duration,
            description: `Follow-up call with recording available at: ${
              RecordingUrl || ""
            }`,
            billable: true,
            callResult: "",
            crmToken: devToken,
            providerNumber,
            findZohoNumber: call.direction.includes("outbound")
              ? call.to
              : call.from,
          };
          await createCallRecordInZoho(zohoCallRecordData);
          if (req.query?.messageId) {
            // update message status for voice campaign
            const messageId = req.query.messageId;
            let status = call.status;
            if (
              call.status === "busy" ||
              call.status === "no-answer" ||
              call.status === "completed" ||
              call.status === "failed"
            ) {
              status = call.status;
            } else {
              status = "busy";
            }
            await updateMessageStatusById(messageId, status);
          }
          console.log({ "Add call record response: ": resp });
        }

        if (call?.price) {
          const callPrice = call.price;
          const parentCallPrice = parentCall?.price
            ? parentCall?.price
            : "-0.0";

          // Convert the string prices to numbers
          const callPriceNumber = parseFloat(callPrice);
          const parentCallPriceNumber = parseFloat(parentCallPrice);

          // Sum the prices
          const totalPrice = (callPriceNumber + parentCallPriceNumber) * 1.4;

          const callDetails = {
            to: toNumber,
            from: fromNumber,
            recordingUrl: RecordingUrl || "",
            callDuration: CallDuration,
            callDirection: callDirection,
            price: totalPrice.toString(),
            currency: call.priceUnit,
            callSid: CallSid,
            parentCallSid: ParentCallSid || "",
            parentCallPrice: parentCall?.price || "-0.0",
          };

          const newCall = new Call({
            callSid: CallSid,
            parentCallSid: ParentCallSid || "",
            accountSid: AccountSid,
            to: toNumber,
            from: fromNumber,
            recordingUrl: RecordingUrl || "",
            duration: CallDuration,
            direction: callDirection,
            callPrice: call.price,
            parentCallPrice: parentCall?.price || "-0.0",
            currency: call.priceUnit,
            totalPrice: totalPrice.toString(),
          });
          await newCall.save();

          let resp = await addCallRecord(devToken, callDetails);

          const zohoCallRecordData = {
            subject:
              call.status === "busy" || call.status === "no-answer"
                ? "Missed Call"
                : call.direction.includes("outbound")
                ? `Outgoing Call ${call.to}`
                : `Incoming Call ${call.from}`,
            callType:
              call.status === "busy" || call.status === "no-answer"
                ? "Missed"
                : call.direction.includes("outbound")
                ? "Outbound"
                : "Inbound",
            callPurpose: "Follow-up",
            callFrom: call.from,
            relatedTo: "", // zoho crm id
            callDetails: call.status,
            callStartTime: call.startTime,
            callDuration: call.duration,
            description: `Follow-up call with recording available at: ${
              RecordingUrl || ""
            }`,
            billable: true,
            callResult: "",
            crmToken: devToken,
            providerNumber,
            findZohoNumber: call.direction.includes("outbound")
              ? call.to
              : call.from,
          };
          await createCallRecordInZoho(zohoCallRecordData);
          if (req.query?.messageId) {
            // update message status for voice campaign
            const messageId = req.query.messageId;
            let status = call.status;
            if (
              call.status === "busy" ||
              call.status === "no-answer" ||
              call.status === "completed" ||
              call.status === "failed"
            ) {
              status = call.status;
            } else {
              status = "busy";
            }
            await updateMessageStatusById(messageId, status);
          }
          console.log({ "Add call record response: ": resp });
        } else {
          console.log(
            `Price not available yet. Retrying... (${retryCount + 1})`
          );
          setTimeout(() => fetchCallDetails(retryCount + 1), 5000); // Retry after 5 seconds
        }
      } catch (error) {
        console.error("Error in add call record to CRMM: ", error);
      }
    };

    setTimeout(() => fetchCallDetails(), 10000); // Initial delay before first fetch
  }

  // if (req.body.CallStatus === "completed" && req.query?.confressName) {
  //   const confressName = req.query?.confressName;
  //   const client = twilio(resData.account_sid, resData.account_token);

  //   try {
  //     await client.conferences(confressName).update({ status: "completed" });
  //     console.log("Conference ended successfully.");
  //   } catch (error) {
  //     console.error("Error ending the conference:", error);
  //   }
  // }

  res.status(200).end();
};

const makeConfrenceCall = async (req, res) => {
  const token = req.token;
  const { toNumber, fromNumber, agentNumber } = req.body;
  try {
    const providerNumber = sanitizePhoneNumber(fromNumber);
    const resData = await getProviderDetails(token, providerNumber);
    if (!resData || !resData.provider_number) {
      return res
        .status(404)
        .json({ success: false, message: "Provider details not found" });
    }
    const client = twilio(resData.account_sid, resData.account_token);
    const voiceBackendUrl = BASE_URL;
    // Step 1: Call the customer and direct them to the conference room
    const call = await client.calls.create({
      url: `${voiceBackendUrl}/api/twilioConfrenceCallWebhook?step=customer&agentNumber=${encodeURIComponent(
        agentNumber
      )}&confressName=${fromNumber}_${toNumber}`,
      to: toNumber,
      from: fromNumber, // Replace with your Twilio number
      record: true,
      statusCallback: `${voiceBackendUrl}/api/callStatusTextToSpeech?confressName=${fromNumber}_${toNumber}`,
    });
    res.status(200).send({
      success: true,
      message: `Initiating call to customer: ${call.sid}`,
      callSid: call.sid,
    });
  } catch (error) {
    console.log("Error in make confrence call: ", error?.message);
    res.status(500).json({
      success: false,
      message: error?.message,
    });
  }
};

const makeMyOperatorCall = async (req, res) => {
  const { crmToken, providerNumber, toNumber } = req.body;
  try {
    const withoutPlusNumber = sanitizePhoneNumber(providerNumber);
    let resData = await getProviderDetails(crmToken, providerNumber);
    if (!resData) {
      resData = await getProviderDetails(crmToken, withoutPlusNumber);
    }
    if (!resData) {
      return res.status(404).json({
        success: false,
        message: "Provider details not found",
      });
    }
    //  make my operator india calling
    const apiKey = resData.twilio_api_key;
    const formData = {
      company_id: resData.msgServiceId,
      secret_token: resData.jwtToken,
      type: resData.type,
      number: toNumber.startsWith("+") ? toNumber : `+${toNumber}`,
      caller_id: resData.provider_number.startsWith("+")
        ? resData.provider_number
        : `+${resData.provider_number}`,
      group: resData.twiml_app_sid,
      region: resData.appid,
      public_ivr_id: resData.twilio_api_secret,
    };
    if (resData.type === "1") {
      formData.user_id = resData.agentNumber;
    }
    const response = await axios.post(
      "https://obd-api.myoperator.co/obd-api-v1",
      formData,
      {
        headers: {
          "x-api-key": apiKey,
        },
      }
    );
    res.status(200).json(response.data);
  } catch (error) {
    console.log("Error in makeMyOperatorCall: ", error);
    res.status(500).json({
      success: false,
      message: error?.message,
    });
  }
};

const checkMyOperatorCallStatus = async (req, res) => {
  const { callUniqueId } = req.body;
  try {
    const callDetail = await Call.findOne({ callSid: callUniqueId });
    if (!callDetail) {
      return res.status(404).json({
        success: false,
        message: "Call not found",
      });
    }
    res.status(200).json({
      success: true,
      message: "Call found",
    });
  } catch (error) {
    console.log("Error in check myOperator call status: ", error?.message);
    res.status(500).json({
      success: false,
      message: error?.message,
    });
  }
};
const confrenceCallStatusWebhook = async (req, res) => {
  const twiml = new twilio.twiml.VoiceResponse();
  const step = Array.isArray(req.query.step)
    ? req.query.step[0]
    : req.query.step;
  const CallStatus = req.query.CallStatus || req.body.CallStatus;
  const CallSid = req.query.CallSid || req.body.CallSid;
  const agentNumber = req.query.agentNumber;
  const conferenceRoomName = req.query.confressName;

  console.log({ conferenceRoomName });

  const fromNumber = req.body.From;

  try {
    const providerNumber = sanitizePhoneNumber(fromNumber);
    const devToken = await getTokenFromNumber(providerNumber);
    if (!devToken) {
      return res.status(404).end();
    }
    console.log({ devToken, providerNumber });
    const resData = await getProviderDetails(devToken, providerNumber);
    if (resData && resData.provider_number) {
      const TWILIO_ACCOUNT_DETAIL = {
        accountSid: resData.account_sid,
        authToken: resData.account_token,
      };
      const client = require("twilio")(
        TWILIO_ACCOUNT_DETAIL.accountSid,
        TWILIO_ACCOUNT_DETAIL.authToken
      );

      console.log(
        "Webhook hit. Step:",
        step,
        "CallStatus:",
        CallStatus,
        "CallSid:",
        CallSid
      );

      if (step === "customer" && CallStatus === "in-progress") {
        // Step 2: Direct the customer to the conference room
        console.log("Customer answered. Redirecting to conference room...");
        console.log({ agentNumber, fromNumber });

        // Add the introductory message
        twiml.say("Please hold on, we are connecting you to the conference.");

        // Optional: Add a slight pause to make the transition smoother
        twiml.pause({ length: 2 }); // Pause for 2 seconds

        twiml.dial().conference(conferenceRoomName);
        res.type("text/xml");
        res.send(twiml.toString());

        // Initiate call to agent after customer joins conference
        setTimeout(async () => {
          try {
            const voiceBackendUrl = BASE_URL;
            const callResp = await client.calls.create({
              url: `${voiceBackendUrl}/api/twilioConfrenceCallWebhook?step=agent&confressName=${conferenceRoomName}`,
              to: agentNumber,
              from: fromNumber, // Replace with your Twilio number
              record: true,
              statusCallback: `${voiceBackendUrl}/api/callStatusTextToSpeech?confressName=${conferenceRoomName}`,
            });
            console.log("Agent call initiated successfully: ", {
              sid: callResp.sid,
            });
          } catch (error) {
            console.error("Error initiating call to agent:", error?.message);
          }
        }, 1000);
      } else if (step === "agent" && CallStatus === "in-progress") {
        // Step 3: Direct the agent to the same conference room
        console.log(
          "Agent answered. Connecting to the same conference room..."
        );

        twiml.dial().conference(conferenceRoomName);
        res.type("text/xml");
        res.send(twiml.toString());
      } else if (CallStatus === "completed") {
        // Step 4: Handle call completion to end the conference
        console.log("A participant has disconnected. Ending the conference...");

        // Terminate the conference by ending the call
        try {
          await client
            .conferences(conferenceRoomName)
            .update({ status: "completed" });
          console.log("Conference ended successfully.");
        } catch (error) {
          console.error("Error ending the conference:", error);
        }

        res.type("text/xml");
        res.send(twiml.toString());
      } else {
        console.log("Invalid webhook call or status.");
        res.status(404).send("Invalid request");
      }
    } else {
      console.log("Provider details not found");
      res
        .status(404)
        .json({ success: false, message: "Provider details not found" });
    }
  } catch (error) {
    console.log("Call confrence status controller: ", error?.message);
    res.status(500).send();
  }
};

const callStatusWebhook = async (req, res) => {
  const {
    RecordingUrl,
    To,
    From,
    CallDuration,
    CallSid,
    ParentCallSid,
    AccountSid,
  } = req.body;

  const callStatus = req.body.CallStatus;

  let toNumber, fromNumber, callDirection;
  if (To.startsWith("client:")) {
    toNumber = extractNumberFromClient(To);
    fromNumber = From;
    callDirection = "incoming";
  } else {
    toNumber = To;
    fromNumber = From;
    callDirection = "outgoing";
  }
  const providerNumber = sanitizePhoneNumber(
    callDirection === "outgoing" ? fromNumber : toNumber
  );
  const devToken = await getTokenFromNumber(providerNumber);
  if (!devToken) {
    return res.status(404).end();
  }

  if (
    (callStatus === "no-answer" || callStatus === "busy") &&
    callDirection === "incoming"
  ) {
    const missedCallAction = await MissedCallAction.findOne({
      applyNumber: toNumber,
    });

    if (missedCallAction) {
      // so perform the action
      let channel = "";
      if (missedCallAction.actionType === "sms") {
        channel = "sms";
      } else if (missedCallAction.actionType === "whatsapp") {
        channel = "whatsapp";
      }
      let msgData = {
        actionType: channel,
        toNumber: fromNumber,
        fromNumber: missedCallAction.fromNumber,
        message: missedCallAction.message,
        templateName: missedCallAction.templateName,
      };
      if (channel) {
        await sendMessage(devToken, msgData);
      }
    }
  }

  const resData = await getProviderDetails(devToken, providerNumber);
  if (resData && resData.provider_number) {
    const TWILIO_ACCOUNT_DETAIL = {
      accountSid: AccountSid,
      authToken: resData.account_token,
    };
    const client = require("twilio")(
      TWILIO_ACCOUNT_DETAIL.accountSid,
      TWILIO_ACCOUNT_DETAIL.authToken
    );

    const fetchCallDetails = async (retryCount = 0) => {
      if (retryCount > 10) {
        // Maximum retries
        console.error("Failed to fetch call price after multiple attempts");
        return;
      }
      try {
        const call = await client.calls(CallSid).fetch();
        console.log({ findCall: call });
        let parentCall;
        if (ParentCallSid) {
          parentCall = await client.calls(ParentCallSid).fetch();
        }
        if (retryCount === 10 && !call.price) {
          const totalPrice = "-0.1";

          const callDetails = {
            to: call.to,
            from: call.from,
            recordingUrl: RecordingUrl || "",
            callDuration: CallDuration,
            callDirection:
              call.direction === "outbound-dial" ? "outgoing" : "incoming",
            price: totalPrice,
            currency: call?.priceUnit,
            callSid: CallSid,
          };
          const newCall = new Call({
            callSid: CallSid,
            parentCallSid: ParentCallSid,
            accountSid: AccountSid,
            to: call.to,
            from: call.from,
            recordingUrl: RecordingUrl || "",
            duration: CallDuration,
            direction:
              call.direction === "outbound-dial" ? "outgoing" : "incoming",
            callPrice: totalPrice,
            parentCallPrice: totalPrice,
            currency: call.priceUnit,
            totalPrice: totalPrice,
          });
          await newCall.save();

          if (call.status === "completed") {
            let resp = await addCallRecord(devToken, callDetails);
          }
          const zohoCallRecordData = {
            subject:
              call.status === "busy" || call.status === "no-answer"
                ? "Missed Call"
                : call.direction.includes("outbound")
                ? `Outgoing Call ${call.to}`
                : `Incoming Call ${call.from}`,
            callType:
              call.status === "busy" || call.status === "no-answer"
                ? "Missed"
                : call.direction.includes("outbound")
                ? "Outbound"
                : "Inbound",
            callPurpose: "Follow-up",
            callFrom: call.from,
            relatedTo: "", // zoho crm id
            callDetails: call.status,
            callStartTime: call.startTime,
            callDuration: call.duration,
            description: `Follow-up call with recording available at: ${
              RecordingUrl || ""
            }`,
            billable: true,
            callResult: "",
            crmToken: devToken,
            providerNumber,
            findZohoNumber: call.direction.includes("outbound")
              ? call.to
              : call.from,
          };
          await createCallRecordInZoho(zohoCallRecordData);

          if (call.direction.includes("inbound")) {
            createZohoIncomingCallLead(devToken, call.from);
          }
        }

        if (call?.price) {
          const callPrice = call.price;
          const parentCallPrice = parentCall?.price
            ? parentCall?.price
            : "-0.0";

          // Convert the string prices to numbers
          const callPriceNumber = parseFloat(callPrice);
          const parentCallPriceNumber = parseFloat(parentCallPrice);

          // Sum the prices
          const totalPrice = (callPriceNumber + parentCallPriceNumber) * 1.4;

          const callDetails = {
            to: call.to,
            from: call.from,
            recordingUrl: RecordingUrl || "",
            callDuration: CallDuration,
            callDirection:
              call.direction === "outbound-dial" ? "outgoing" : "incoming",
            price: totalPrice.toString(),
            currency: call.priceUnit,
            callSid: CallSid,
          };
          const newCall = new Call({
            callSid: CallSid,
            parentCallSid: ParentCallSid,
            accountSid: AccountSid,
            to: call.to,
            from: call.from,
            recordingUrl: RecordingUrl || "",
            duration: CallDuration,
            direction:
              call.direction === "outbound-dial" ? "outgoing" : "incoming",
            callPrice: call.price,
            parentCallPrice: parentCall.price,
            currency: call.priceUnit,
            totalPrice: totalPrice.toString(),
          });
          await newCall.save();

          const resp = await addCallRecord(devToken, callDetails);
          const zohoCallRecordData = {
            subject:
              call.status === "busy" || call.status === "no-answer"
                ? "Missed Call"
                : call.direction.includes("outbound")
                ? `Outgoing Call ${call.to}`
                : `Incoming Call ${call.from}`,
            callType:
              call.status === "busy" || call.status === "no-answer"
                ? "Missed"
                : call.direction.includes("outbound")
                ? "Outbound"
                : "Inbound",
            callPurpose: "Follow-up",
            callFrom: call.from,
            relatedTo: "", // zoho crm id
            callDetails: call.status,
            callStartTime: call.startTime,
            callDuration: call.duration,
            description: `Follow-up call with recording available at: ${
              RecordingUrl || ""
            }`,
            billable: true,
            callResult: "",
            crmToken: devToken,
            providerNumber,
            findZohoNumber: call.direction.includes("outbound")
              ? call.to
              : call.from,
          };
          await createCallRecordInZoho(zohoCallRecordData);

          if (call.direction.includes("inbound")) {
            createZohoIncomingCallLead(devToken, call.from);
          }
        } else {
          console.log(
            `Price not available yet. Retrying... (${retryCount + 1})`
          );
          setTimeout(() => fetchCallDetails(retryCount + 1), 5000); // Retry after 5 seconds
        }
      } catch (error) {
        console.error(error);
      }
    };

    setTimeout(() => fetchCallDetails(), 10000); // Initial delay before first fetch
  }

  res.status(200).end();
};

// webhook endpoint for myOperator call
// const myOperatorCallWebhook = async (req, res) => {
//   const webhookData = req.body;

//   const { to, from, recording, status, direction } = req.query;
//   const callId = webhookData?._ri;
//   console.log({ Query: req.query, Body: JSON.stringify(req.body) });

//   try {
//     // Define call direction based on the `_ty` property

//     const providerNumber = sanitizePhoneNumber(from);
//     const devToken = await getTokenFromNumber(providerNumber);

//     // Extract duration in seconds by converting '_dr' to a number format
//     const durationParts = webhookData._dr ? webhookData._dr.split(":") : "";
//     const callDurationInSeconds = webhookData._dr
//       ? parseInt(durationParts[0]) * 3600 +
//         parseInt(durationParts[1]) * 60 +
//         parseInt(durationParts[2])
//       : "0";

//     let callStatus = "";
//     if (status === "1") {
//       callStatus = "completed";
//     } else if (status === "2") {
//       callStatus = "missed";
//     }
//     const callDetails = {
//       callSid: `${webhookData._ri}`, // Unique Call ID
//       to, // Recipient number
//       from, // Caller number
//       recordingUrl: recording || "NA", // Recording URL if available
//       callDuration: callDurationInSeconds, // Duration in seconds
//       callDirection: direction, // Incoming or outgoing
//       status: callStatus,
//       startTime: new Date(webhookData._st * 1000).toISOString(), // Start time in ISO format
//       endTime: new Date(webhookData._et * 1000).toISOString(), // End time in ISO format
//     };

//     console.log("Parsed Call Details:", callDetails);

//     const newCall = new Call(callDetails);
//     await newCall.save();

//     if (!devToken) {
//       return res.status(404).end();
//     }

//     // add call record to zoho
//     const zohoCallRecordData = {
//       subject:
//         callStatus === "missed"
//           ? "Missed Call"
//           : direction === "outgoing"
//           ? `Outgoing Call ${to}`
//           : `Incoming Call ${from}`,
//       callType:
//         callStatus === "missed"
//           ? "Missed"
//           : direction === "outgoing"
//           ? "Outbound"
//           : "Inbound",
//       callPurpose: "Follow-up",
//       callFrom: from,
//       relatedTo: "", // zoho crm id
//       callDetails: callStatus,
//       callStartTime: callDetails.startTime,
//       callDuration: callDetails.callDuration,
//       description: `Follow-up call with recording available at: ${
//         recording || ""
//       }`,
//       billable: true,
//       callResult: "",
//       crmToken: devToken,
//       providerNumber,
//       findZohoNumber: direction === "outgoing" ? to : from,
//     };
//     await createCallRecordInZoho(zohoCallRecordData);

//     if (callId) {
//       let status = callStatus;
//       if (callStatus === "missed") status = "busy";
//       await updateMessageStatusByCallId(callId, status);
//     }

//     // You can then save callDetails to your database or log it as required
//   } catch (error) {
//     console.error("Error processing webhook data:", error);
//     return res
//       .status(500)
//       .json({ status: "error", message: "Internal server error" });
//   }

//   res.status(200).json({ status: "success" });
// };

const myOperatorCallWebhook = async (req, res) => {
  const webhookData = req.body;
  const { direction } = req.query;

  try {
    const callId = webhookData?._ri;

    const to = webhookData._cl || "";
    const from = webhookData._ld?.[0]?._did || "";
    const statusCode = webhookData._su; // 1 = success/completed, 2 = missed etc.
    const recording = webhookData._fu || "";
    const audioFileUrl = webhookData._fn || "";

    const providerNumber = sanitizePhoneNumber(from);
    let devToken = await getTokenFromNumber(providerNumber);
    if (!devToken) {
      await getTokenFromNumber(from);
    }

    // Duration conversion
    const durationParts = webhookData._dr ? webhookData._dr.split(":") : [];
    const callDurationInSeconds =
      durationParts.length === 3
        ? parseInt(durationParts[0]) * 3600 +
          parseInt(durationParts[1]) * 60 +
          parseInt(durationParts[2])
        : 0;

    // Call status
    let callStatus = "";
    if (statusCode === 1) {
      callStatus = "completed";
    } else if (statusCode === 2 || callDurationInSeconds === 0) {
      callStatus = "missed";
    }

    const callDetails = {
      callSid: callId,
      to,
      from,
      recordingUrl: recording,
      duration: callDurationInSeconds,
      direction: direction,
      status: callStatus,
      startTime: new Date(webhookData._st * 1000).toISOString(),
      endTime: new Date(webhookData._et * 1000).toISOString(),
    };

    const newCall = new Call(callDetails);
    await newCall.save();

    console.log("Parsed Call Details:", callDetails);

    let resProviderData = await getProviderDetails(devToken, providerNumber);
    if (!resProviderData) {
      resProviderData = await getProviderDetails(devToken, from);
    }

    const myOperatorToken = resProviderData?.subdomain;

    // get recording url
    let recordingUrl = "";
    if (audioFileUrl) {
      recordingUrl = await getMyOperatorRecordingUrl(
        myOperatorToken,
        audioFileUrl
      );
    }
    newCall.recordingUrl = recordingUrl;
    await newCall.save();

    if (!devToken) {
      return res.status(404).end();
    }

    const zohoCallRecordData = {
      subject:
        callStatus === "missed"
          ? "Missed Call"
          : direction === "outgoing"
          ? `Outgoing Call ${to}`
          : `Incoming Call ${from}`,
      callType:
        callStatus === "missed"
          ? "Missed"
          : direction === "outgoing"
          ? "Outbound"
          : "Inbound",
      callPurpose: "Follow-up",
      callFrom: from,
      relatedTo: "", // Add Zoho related record ID here if available
      callDetails: callStatus,
      callStartTime: callDetails.startTime,
      callDuration: callDetails.duration,
      description: `Follow-up call with recording available at: ${recordingUrl}`,
      billable: true,
      callResult: "",
      crmToken: devToken,
      providerNumber,
      findZohoNumber: direction === "outgoing" ? to : from,
    };

    await createCallRecordInZoho(zohoCallRecordData);

    if (callId) {
      let statusForMessage = callStatus;
      if (callStatus === "missed") statusForMessage = "busy";
      await updateMessageStatusByCallId(callId, statusForMessage);
    }

    res.status(200).json({ status: "success" });
  } catch (error) {
    console.error("Error processing webhook data:", error);
    res.status(500).json({ status: "error", message: "Internal server error" });
  }
};

// const myOperatorCallLogs = async (req, res) => {
//   const token = req.token;

//   const pageLimit = parseInt(req.query.pageLimit, 10) || 10;
//   const currentPage = parseInt(req.query.currentPage, 10) || 1;
//   const rawVoiceNumber = req.query.voiceNumber;
//   const toNumber = req.query.toNumber

//   if (!rawVoiceNumber) {
//     return res.status(400).json({
//       success: false,
//       message: "voiceNumber query parameter is required",
//     });
//   }

//   // Handle both + and non + versions
//   const withPlus = rawVoiceNumber.startsWith("+")
//     ? rawVoiceNumber
//     : `+${rawVoiceNumber}`;
//   const withoutPlus = rawVoiceNumber.replace(/^\+/, "");

//   try {
//     const query = {
//       $or: [
//         { from: withPlus },
//         { to: withPlus },
//         { from: withoutPlus },
//         { to: withoutPlus },
//       ],
//     };

//     const totalResults = await Call.countDocuments(query);
//     const callLogs = await Call.find(query)
//       .sort({ createdAt: -1 })
//       .skip((currentPage - 1) * pageLimit)
//       .limit(pageLimit);

//     return res.status(200).json({
//       success: true,
//       message: "Found",
//       data: callLogs,
//       totalResults,
//       currentPage,
//       pageLimit,
//       currentPageResults: callLogs.length,
//     });
//   } catch (error) {
//     console.log("Error in call logs: ", error?.message);
//     return res.status(500).json({
//       success: false,
//       message: "Call logs not found",
//     });
//   }
// };

const myOperatorCallLogs = async (req, res) => {
  const token = req.token;

  const pageLimit = parseInt(req.query.pageLimit, 10) || 10;
  const currentPage = parseInt(req.query.currentPage, 10) || 1;
  const rawVoiceNumber = req.query.voiceNumber;
  const toNumber = req.query?.toNumber || "";

  if (!rawVoiceNumber) {
    return res.status(400).json({
      success: false,
      message: "voiceNumber query parameter is required",
    });
  }

  const withPlus = rawVoiceNumber.startsWith("+")
    ? rawVoiceNumber
    : `+${rawVoiceNumber}`;
  const withoutPlus = rawVoiceNumber.replace(/^\+/, "");

  const query = {
    $or: [
      { from: withPlus },
      { to: withPlus },
      { from: withoutPlus },
      { to: withoutPlus },
    ],
  };

  if (toNumber) {
    query.$and = [
      {
        $or: [
          { to: { $regex: toNumber, $options: "i" } },
          { from: { $regex: toNumber, $options: "i" } },
        ],
      },
    ];
  }

  console.log({ query: JSON.stringify(query) });

  try {
    const totalResults = await Call.countDocuments(query);
    const callLogs = await Call.find(query)
      .sort({ createdAt: -1 })
      .skip((currentPage - 1) * pageLimit)
      .limit(pageLimit);

    return res.status(200).json({
      success: true,
      message: "Found",
      data: callLogs,
      totalResults,
      currentPage,
      pageLimit,
      currentPageResults: callLogs.length,
    });
  } catch (error) {
    console.log("Error in call logs: ", error?.message);
    return res.status(500).json({
      success: false,
      message: "Call logs not found",
    });
  }
};

/**
 * Checks if the given value is valid as phone number
 * @param {Number|String} number
 * @return {Boolean}
 */
function isAValidPhoneNumber(number) {
  return /^[\d\+\-\(\) ]+$/.test(number);
}

module.exports = {
  tokenGenerator,
  voiceResponse,
  makeOutgoingTextToSpeechCall,
  recordingCall,
  callStatusTextToSpeech,
  callStatusWebhook,
  confrenceCallStatusWebhook,
  makeConfrenceCall,
  myOperatorCallWebhook,
  makeMyOperatorCall,
  checkMyOperatorCallStatus,
  myOperatorCallLogs,
};
