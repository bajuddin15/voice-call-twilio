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

const tokenGenerator = async (req, res) => {
  const { devToken, providerNumber } = req.body;

  try {
    const resData = await getProviderDetails(devToken, providerNumber);
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

      const identity = twilioAccountDetails?.provider_number;

      const accessToken = new AccessToken(
        twilioAccountDetails.account_sid,
        twilioAccountDetails.twilio_api_key,
        twilioAccountDetails.twilio_api_secret
      );

      accessToken.identity = identity;
      const grant = new VoiceGrant({
        outgoingApplicationSid: twilioAccountDetails.twiml_app_sid,
        incomingAllow: true,
      });
      accessToken.addGrant(grant);

      const twilioDetails = await TwilioAccountDetails.findOne({
        identity: twilioAccountDetails.provider_number,
      });

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

    if (callForwarding?.isEnabled && callForwarding?.toPhoneNumber) {
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
        const provider_number = sanitizePhoneNumber(identity);
        const devToken = await getTokenFromNumber(provider_number);
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
      if (retryCount >= 5) {
        // Maximum retries
        console.error("Failed to fetch call price after multiple attempts");
        return;
      }
      try {
        const call = await client.calls(CallSid).fetch();
        const parentCall = await client.calls(ParentCallSid).fetch();

        if (call.price) {
          const callPrice = call.price;
          const parentCallPrice = parentCall.price ? parentCall.price : "-0.0";

          // Convert the string prices to numbers
          const callPriceNumber = parseFloat(callPrice);
          const parentCallPriceNumber = parseFloat(parentCallPrice);

          // Sum the prices
          const totalPrice = (callPriceNumber + parentCallPriceNumber) * 1.4;

          const callDetails = {
            to: toNumber,
            from: fromNumber,
            recordingUrl: RecordingUrl,
            callDuration: CallDuration,
            callDirection: callDirection,
            price: totalPrice.toString(),
            currency: call.priceUnit,
            callSid: CallSid,
            parentCallSid: ParentCallSid,
            parentCallPrice: parentCall.price,
          };

          const newCall = new Call({
            callSid: CallSid,
            parentCallSid: ParentCallSid,
            accountSid: AccountSid,
            to: toNumber,
            from: fromNumber,
            recordingUrl: RecordingUrl,
            callDuration: CallDuration,
            callDirection: callDirection,
            callPrice: call.price,
            parentCallPrice: parentCall.price,
            currency: call.priceUnit,
            totalPrice: totalPrice.toString(),
          });
          await newCall.save();

          const resp = await addCallRecord(devToken, callDetails);
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
        toNumber: missedCallAction.applyNumber,
        fromNumber: missedCallAction.fromNumber,
        message: missedCallAction.message,
        templateName: missedCallAction.templateName,
      };
      if (channel) {
        await sendMessage(token, msgData);
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
      if (retryCount >= 5) {
        // Maximum retries
        console.error("Failed to fetch call price after multiple attempts");
        return;
      }
      try {
        const call = await client.calls(CallSid).fetch();
        const parentCall = await client.calls(ParentCallSid).fetch();

        if (call.price) {
          const callPrice = call.price;
          const parentCallPrice = parentCall.price ? parentCall.price : "-0.0";

          // Convert the string prices to numbers
          const callPriceNumber = parseFloat(callPrice);
          const parentCallPriceNumber = parseFloat(parentCallPrice);

          // Sum the prices
          const totalPrice = (callPriceNumber + parentCallPriceNumber) * 1.4;

          const callDetails = {
            to: call.to,
            from: call.from,
            recordingUrl: RecordingUrl,
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
            recordingUrl: RecordingUrl,
            callDuration: CallDuration,
            callDirection:
              call.direction === "outbound-dial" ? "outgoing" : "incoming",
            callPrice: call.price,
            parentCallPrice: parentCall.price,
            currency: call.priceUnit,
            totalPrice: totalPrice.toString(),
          });
          await newCall.save();

          const resp = await addCallRecord(devToken, callDetails);
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
};
