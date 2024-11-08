const twilio = require("twilio");
const moment = require("moment");
const { Parser } = require("json2csv");
const {
  addTwilioSmsProvider,
  addTwilioVoiceProvider,
} = require("../../utils/api");
const Subaccount = require("../models/subaccount.models");
const PhoneNumber = require("../models/phoneNumber.models");
const {
  formatAverageCallsDuration,
  addPlusInNumber,
} = require("../../utils/common");
const Call = require("../models/call.models");
const { BASE_URL } = require("../../utils/constants");

const getCallLogs = async (req, res) => {
  const token = req.token;

  // Extract pageLimit, currentPage, and voiceNumber from query parameters, with defaults
  const pageLimit = parseInt(req.query.pageLimit, 10) || 10;
  const currentPage = parseInt(req.query.currentPage, 10) || 1;
  const voiceNumber = addPlusInNumber(req.query.voiceNumber);

  if (!voiceNumber) {
    return res.status(400).json({
      success: false,
      message: "voiceNumber query parameter is required",
    });
  }

  try {
    const subaccount = await Subaccount.findOne({ crmToken: token });

    if (!subaccount) {
      return res.status(404).json({
        success: false,
        message: "Subaccount not found",
      });
    }
    const accountSid = subaccount.accountSid;
    const authToken = subaccount.authToken;

    const client = twilio(accountSid, authToken);

    // Calculate the offset for pagination
    const offset = (currentPage - 1) * pageLimit;

    // Fetch a larger batch of calls to account for filtering
    // const fetchLimit = pageLimit * 4; // Adjust as needed to ensure sufficient results after filtering
    const rawCalls = await client.calls.list();

    // Filter out unwanted calls
    const filteredCalls = rawCalls.filter(
      (c) =>
        (c.from === voiceNumber || c.to === voiceNumber) &&
        !c.from.startsWith("client:") &&
        !c.to.startsWith("client:")
    );

    // Calculate total results after filtering
    const totalResults = filteredCalls.length;

    // Get the calls for the current page
    const calls = filteredCalls.slice(offset, offset + pageLimit);

    const callLogs = await Promise.all(
      calls.map(async (c) => {
        const recordings = await client.recordings.list({
          callSid: c.sid,
          limit: 1,
        });
        let recordingUrl =
          recordings.length > 0
            ? `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Recordings/${recordings[0].sid}`
            : null;

        if (!recordingUrl && c.status === "completed") {
          const callData = await Call.findOne({ callSid: c.sid });
          recordingUrl = callData?.recordingUrl;
        }

        // Determine direction (incoming or outgoing)
        const direction = c.direction === "inbound" ? "incoming" : "outgoing";

        return {
          sid: c.sid,
          from: c.from,
          to: c.to,
          status: c.status,
          startTime: c.startTime,
          endTime: c.endTime,
          duration: c.duration,
          recordingUrl,
          direction, // Add direction field
        };
      })
    );

    const response = {
      success: true,
      message: "Found",
      data: callLogs,
      totalResults,
      currentPage,
      pageLimit,
      currentPageResults: callLogs?.length,
    };

    res.json(response);
  } catch (error) {
    console.error("Error in retrieving call logs:", error.message);
    res.status(500).json({ error: "Failed to retrieve call logs" });
  }
};
const getCallLogsByToNumber = async (req, res) => {
  const token = req.token;

  // Extract pageLimit, currentPage, voiceNumber, and toNumber from query parameters, with defaults
  const pageLimit = parseInt(req.query.pageLimit, 10) || 10;
  const currentPage = parseInt(req.query.currentPage, 10) || 1;
  const voiceNumber = addPlusInNumber(req.query.voiceNumber);
  const toNumber = addPlusInNumber(req.query.toNumber);

  if (!voiceNumber) {
    return res.status(400).json({
      success: false,
      message: "voiceNumber query parameter is required",
    });
  }

  if (!toNumber) {
    return res.status(400).json({
      success: false,
      message: "toNumber query parameter is required",
    });
  }

  try {
    const subaccount = await Subaccount.findOne({ crmToken: token });

    if (!subaccount) {
      return res.status(404).json({
        success: false,
        message: "Subaccount not found",
      });
    }
    const accountSid = subaccount.accountSid;
    const authToken = subaccount.authToken;

    const client = twilio(accountSid, authToken);

    // Calculate the offset for pagination
    const offset = (currentPage - 1) * pageLimit;

    // Fetch a larger batch of calls to account for filtering
    // const fetchLimit = pageLimit; // Adjust as needed to ensure sufficient results after filtering
    const rawCalls = await client.calls.list();
    console.log({ rawCalls: rawCalls.length });

    // Filter out unwanted calls
    const filteredCalls = rawCalls.filter(
      (c) =>
        (c.from === voiceNumber || c.to === voiceNumber) &&
        (c.from === toNumber || c.to === toNumber) &&
        !c.from.startsWith("client:") &&
        !c.to.startsWith("client:")
    );

    // Calculate total results after filtering
    const totalResults = filteredCalls.length;

    // Get the calls for the current page
    const calls = filteredCalls.slice(offset, offset + pageLimit);

    const callLogs = await Promise.all(
      calls.map(async (c) => {
        const recordings = await client.recordings.list({
          callSid: c.sid,
          limit: 1,
        });
        let recordingUrl =
          recordings.length > 0
            ? `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Recordings/${recordings[0].sid}`
            : null;

        if (!recordingUrl && c.status === "completed") {
          const callData = await Call.findOne({ callSid: c.sid });
          recordingUrl = callData?.recordingUrl;
        }

        // Determine direction (incoming or outgoing)
        const direction = c.direction === "inbound" ? "incoming" : "outgoing";

        return {
          sid: c.sid,
          from: c.from,
          to: c.to,
          status: c.status,
          startTime: c.startTime,
          endTime: c.endTime,
          duration: c.duration,
          recordingUrl,
          direction, // Add direction field
        };
      })
    );

    const response = {
      success: true,
      message: "Found",
      data: callLogs,
      totalResults,
      currentPage,
      pageLimit,
      currentPageResults: callLogs?.length,
    };

    res.json(response);
  } catch (error) {
    console.error("Error in retrieving call logs:", error.message);
    res.status(500).json({ error: "Failed to retrieve call logs" });
  }
};

const searchAvailableNumbers = async (req, res) => {
  const { country, digits, capabilities, numberTypes } = req.body;

  if (!country) {
    return res.status(400).json({
      success: false,
      message: "Country is required",
    });
  }

  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const client = require("twilio")(accountSid, authToken);

    const options = {
      limit: 100,
    };
    if (digits) {
      options.contains = digits;
    }
    if (capabilities) {
      options.voiceEnabled = capabilities.voice;
      options.smsEnabled = capabilities.sms;
    }

    let numbers = [];

    if (numberTypes.local) {
      const localNumbers = await client
        .availablePhoneNumbers(country)
        .local.list(options);
      numbers = numbers.concat(localNumbers);
    }

    if (numberTypes.mobile) {
      const mobileNumbers = await client
        .availablePhoneNumbers(country)
        .mobile.list(options);
      numbers = numbers.concat(mobileNumbers);
    }

    if (numberTypes.tollFree) {
      const tollFreeNumbers = await client
        .availablePhoneNumbers(country)
        .tollFree.list(options);
      numbers = numbers.concat(tollFreeNumbers);
    }

    res.status(200).json({
      success: true,
      message: "Searched numbers",
      data: numbers,
    });
  } catch (error) {
    console.error("Error in search numbers: ", error?.message);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

const createSubaccountAndPurchaseNumber = async (req, res) => {
  const { email, phoneNumber, paymentStatus, pricePaid } = req.body;
  const crmToken = req.token;

  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const client = twilio(accountSid, authToken);

    // Step 1: Check if subaccount already exists
    let subaccount = await Subaccount.findOne({ email });
    let subaccountSid, subaccountAuthToken;

    if (subaccount) {
      subaccountSid = subaccount.accountSid;
      subaccountAuthToken = subaccount.authToken;
    } else {
      // Step 2: Check if subaccount already exists in Twilio
      const twilioSubaccounts = await client.api.accounts.list();
      const existingSubaccount = twilioSubaccounts.find(
        (acc) => acc.friendlyName === email
      );

      if (existingSubaccount) {
        subaccountSid = existingSubaccount.sid;
        subaccountAuthToken = existingSubaccount.authToken;

        // Save the existing subaccount to the database
        subaccount = new Subaccount({
          email,
          crmToken,
          accountSid: subaccountSid,
          authToken: subaccountAuthToken,
        });

        await subaccount.save();
      } else {
        // Step 3: Create Subaccount in Twilio
        const createdSubaccount = await client.api.accounts.create({
          friendlyName: email,
        });

        if (!createdSubaccount) {
          return res.status(409).json({
            success: false,
            message: "Subaccount not created",
          });
        }

        subaccountSid = createdSubaccount.sid;
        subaccountAuthToken = createdSubaccount.authToken;

        // Save the new subaccount to the database
        subaccount = new Subaccount({
          email,
          crmToken,
          accountSid: subaccountSid,
          authToken: subaccountAuthToken,
        });

        await subaccount.save();
      }
    }

    // Step 3: Verify the phone number
    try {
      await client.validationRequests.create({
        phoneNumber,
        friendlyName: email,
      });
    } catch (error) {
      console.error("Error verifying phone number: ", error?.message);
      return res.status(400).json({
        success: false,
        message: "Failed to verify phone number",
      });
    }

    // Step 4: Purchase Number
    let purchasedNumber;
    let phoneNumberStatus = "pending";
    let messagingServiceSid, twimlAppSid;

    try {
      const subaccountClient = twilio(subaccountSid, subaccountAuthToken);

      // Check or create TwiML app
      const twimlApps = await subaccountClient.applications.list({ limit: 1 });
      if (twimlApps.length > 0) {
        twimlAppSid = twimlApps[0].sid;
      } else {
        const twimlApp = await subaccountClient.applications.create({
          friendlyName: "CRM Messaging Voice App",
          voiceUrl: "https://voice.crm-messaging.cloud/api/voice",
          voiceMethod: "POST",
        });
        twimlAppSid = twimlApp.sid;
      }

      // Check or create messaging service
      const messagingServices = await subaccountClient.messaging.services.list({
        limit: 1,
      });
      if (messagingServices.length > 0) {
        messagingServiceSid = messagingServices[0].sid;
      } else {
        const messagingService =
          await subaccountClient.messaging.services.create({
            friendlyName: "CRM Messaging Service",
          });

        await subaccountClient.messaging.services(messagingService.sid).update({
          inboundRequestUrl:
            "https://app.crm-messaging.cloud/index.php/Message/getMessageTwillio",
          inboundMethod: "POST",
        });

        messagingServiceSid = messagingService.sid;
      }

      // Purchase phone number
      purchasedNumber = await subaccountClient.incomingPhoneNumbers.create({
        phoneNumber,
      });

      // Configure phone number
      await subaccountClient.incomingPhoneNumbers(purchasedNumber.sid).update({
        messagingServiceSid,
        voiceApplicationSid: twimlAppSid,
      });

      console.log("Message service SID mapped with phone number");

      // Fetch phone number details
      const lookupResult = await client.lookups
        .phoneNumbers(purchasedNumber.phoneNumber)
        .fetch();
      const phoneNumberCountry = lookupResult.countryCode;

      const apiKey = await subaccountClient.newKeys.create({
        friendlyName: "CRM Messaging API Key",
      });

      const twilioApiKey = apiKey.sid;
      const twilioApiSecret = apiKey.secret;

      if (purchasedNumber.capabilities.sms) {
        await addTwilioSmsProvider(
          crmToken,
          purchasedNumber.phoneNumber.substring(1),
          phoneNumberCountry,
          messagingServiceSid,
          subaccountSid,
          subaccountAuthToken
        );
      }

      if (purchasedNumber.capabilities.voice) {
        await addTwilioVoiceProvider(
          crmToken,
          purchasedNumber.phoneNumber.substring(1),
          phoneNumberCountry,
          twimlAppSid,
          subaccountSid,
          subaccountAuthToken,
          twilioApiKey,
          twilioApiSecret
        );
      }

      phoneNumberStatus = "purchased";
    } catch (error) {
      console.error("Error purchasing phone number: ", error?.message);
      phoneNumberStatus = "failed";
      return res.status(409).json({
        success: false,
        message: "Number not purchased",
      });
    }

    // Step 5: Save subaccount and phone number details to your database
    const newPhoneNumber = new PhoneNumber({
      crmToken,
      phoneNumber,
      friendlyName: purchasedNumber ? purchasedNumber.friendlyName : null,
      phoneSid: purchasedNumber ? purchasedNumber.sid : null,
      capabilities: purchasedNumber ? purchasedNumber.capabilities : {},
      subaccount: subaccount._id,
      status: phoneNumberStatus,
      paymentStatus,
      pricePaid,
    });

    subaccount.phoneNumbers.push(newPhoneNumber._id);

    await Promise.all([newPhoneNumber.save(), subaccount.save()]);

    res.status(200).json({
      success: true,
      message: "Subaccount and phone number processed successfully",
      data: {
        paymentStatus,
        status: phoneNumberStatus,
      },
    });
  } catch (error) {
    console.error(
      "Error in createSubaccountAndPurchaseNumber: ",
      error?.message
    );
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

const getAllPurchasedNumbers = async (req, res) => {
  try {
    const token = req.token;

    const subaccount = await Subaccount.findOne({ crmToken: token });

    if (!subaccount) {
      return res.status(404).json({
        success: false,
        message: "Subaccount not found",
      });
    }

    const accountSid = subaccount.accountSid;
    const authToken = subaccount.authToken;

    const client = twilio(accountSid, authToken);

    // Fetch purchased phone numbers
    const phoneNumbers = await client.incomingPhoneNumbers.list();
    const purchasedNumbers = phoneNumbers.map((number) => ({
      sid: number?.sid,
      phoneNumber: number?.phoneNumber,
      friendlyName: number?.friendlyName,
      dateCreated: number?.dateCreated,
      dateUpdated: number?.dateUpdated,
      capabilities: number?.capabilities,
      status: number?.status, // Including the status field
    }));

    res.status(200).json({
      success: true,
      message: "Purchased numbers retrieved successfully",
      data: purchasedNumbers,
    });
  } catch (error) {
    console.log(`Error in getAllPurchasedNumbers: `, error?.message);
  }
};

const getCallStatistics = async (req, res) => {
  try {
    const token = req.token;
    const voiceNumber = `+${req.query.voiceNumber}`;
    if (!voiceNumber) {
      return res.status(400).json({
        success: false,
        message: "voiceNumber query parameter is required",
      });
    }

    const subaccount = await Subaccount.findOne({ crmToken: token });

    if (!subaccount) {
      return res.status(404).json({
        success: false,
        message: "Subaccount not found",
      });
    }

    const accountSid = subaccount.accountSid;
    const authToken = subaccount.authToken;

    const client = twilio(accountSid, authToken);

    // Fetch calls from the last 30 days
    const allCalls = await client.calls.list({
      startTimeAfter: moment().subtract(30, "days").toDate(),
    });

    // Filter calls to include only those involving the specified voice number
    const calls = allCalls.filter(
      (c) =>
        (c.from === voiceNumber || c.to === voiceNumber) &&
        !c.from.startsWith("client:") &&
        !c.to.startsWith("client:")
    );

    const totalCalls = calls.length;
    let incomingCalls = 0;
    let outgoingCalls = 0;
    let missedCalls = 0;
    let totalDuration = 0;
    let pickedCallsCount = 0;

    calls.forEach((call) => {
      if (call.direction === "inbound") incomingCalls++;
      if (call.direction === "outbound-api") outgoingCalls++;
      if (
        call.status === "no-answer" ||
        call.status === "busy" ||
        call.status === "canceled"
      )
        missedCalls++;
      if (call.status === "completed") {
        totalDuration += parseInt(call.duration, 10);
        pickedCallsCount++;
      }
    });

    const incomingCallsPercentage = (
      (incomingCalls / totalCalls) *
      100
    ).toFixed(2);
    const outgoingCallsPercentage = (
      (outgoingCalls / totalCalls) *
      100
    ).toFixed(2);
    const missedCallsPercentage = ((missedCalls / totalCalls) * 100).toFixed(2);
    const averageCallDuration =
      pickedCallsCount > 0
        ? formatAverageCallsDuration(totalDuration / pickedCallsCount)
        : "0s";

    res.status(200).json({
      success: true,
      message: "Calls States found",
      data: {
        totalCalls,
        incomingCalls,
        outgoingCalls,
        missedCalls,
        incomingCallsPercentage,
        outgoingCallsPercentage,
        missedCallsPercentage,
        averageCallDuration,
        pickedCalls: pickedCallsCount,
      },
    });
  } catch (error) {
    console.error("Error fetching call statistics:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

const deleteSubaccount = async (req, res) => {
  const subaccountSid = "";

  try {
    if (!subaccountSid) {
      return res
        .status(400)
        .json({ success: false, message: "Subaccount SID is required" });
    }
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    const client = twilio(accountSid, authToken);

    // Update the subaccount status to 'closed'
    await client.api.accounts(subaccountSid).update({ status: "closed" });

    res
      .status(200)
      .json({ success: true, message: "Subaccount deleted successfully" });
  } catch (error) {
    console.error("Error deleting subaccount:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

// assign PhoneNumbers
const assignPhoneNumberToTeam = async (req, res) => {
  try {
    const token = req.token;
    const { phoneSid } = req.params;
    const { memberEmail } = req.body;

    const phone = await PhoneNumber.findOne({ phoneSid, crmToken: token });
    phone.memberEmail = memberEmail || phone.memberEmail;
    await phone.save();

    res.status(200).json({
      success: true,
      message: "Assigned successfully",
    });
  } catch (error) {
    console.log("Error in assignPhoneNumber: ", error?.message);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// add caller id for outbound calls
const sendOtpValidationRequest = async (req, res) => {
  const crmToken = encodeURIComponent(req.token);
  const { email, friendlyName, phoneNumber } = req.body;
  const validPhoneNumber = phoneNumber.startsWith("+")
    ? phoneNumber
    : `+${phoneNumber}`;

  try {
    const parentAccountSid = process.env.TWILIO_ACCOUNT_SID;
    const parentAuthToken = process.env.TWILIO_AUTH_TOKEN;
    const parentAccountClient = twilio(parentAccountSid, parentAuthToken);

    // Step 1: Check if subaccount already exists
    let subaccount = await Subaccount.findOne({ email });
    let subaccountSid, subaccountAuthToken;

    if (subaccount) {
      subaccountSid = subaccount.accountSid;
      subaccountAuthToken = subaccount.authToken;
    } else {
      // Step 2: Check if subaccount already exists in Twilio
      const twilioSubaccounts = await parentAccountClient.api.accounts.list();
      const existingSubaccount = twilioSubaccounts.find(
        (acc) => acc.friendlyName === email
      );

      if (existingSubaccount) {
        subaccountSid = existingSubaccount.sid;
        subaccountAuthToken = existingSubaccount.authToken;

        // Save the existing subaccount to the database
        subaccount = new Subaccount({
          email,
          crmToken,
          accountSid: subaccountSid,
          authToken: subaccountAuthToken,
        });
        await subaccount.save();
      } else {
        // Step 3: Create Subaccount in Twilio
        const createdSubaccount = await parentAccountClient.api.accounts.create(
          { friendlyName: email }
        );

        if (!createdSubaccount) {
          return res.status(409).json({
            success: false,
            message: "Subaccount not created",
          });
        }

        subaccountSid = createdSubaccount.sid;
        subaccountAuthToken = createdSubaccount.authToken;

        // Save the new subaccount to the database
        subaccount = new Subaccount({
          email,
          crmToken,
          accountSid: subaccountSid,
          authToken: subaccountAuthToken,
        });
        await subaccount.save();
      }
    }

    const client = twilio(subaccountSid, subaccountAuthToken);

    // const statusCallbackUrl = `https://workflows.crm-messaging.cloud/workflow/sendwebhookdata/66b21d0a283df02677245072`;
    const statusCallbackUrl = `${BASE_URL}/api/otpValidationStatus?crmToken=${crmToken}&phoneNumber=${encodeURIComponent(
      validPhoneNumber
    )}&friendlyName=${encodeURIComponent(friendlyName)}&subaccountId=${
      subaccount._id
    }`;

    const validationRequest = await client.validationRequests.create({
      friendlyName,
      phoneNumber: validPhoneNumber,
      statusCallback: statusCallbackUrl,
    });
    console.log({ statusCallbackUrl });

    res.status(200).json({
      success: true,
      message: "Request sent",
      data: validationRequest,
    });
  } catch (error) {
    console.log("Error in add caller id: ", error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const deleteOutgoingCallerId = async (req, res) => {
  try {
    const crmToken = req.token;
    const { email, phoneNumber } = req.body;
    let validPhoneNumber = phoneNumber.startsWith("+")
      ? phoneNumber
      : `+${phoneNumber}`;
    const subaccount = await Subaccount.findOne({
      crmToken,
      email,
    });

    if (!subaccount) {
      return res.status(404).json({
        success: false,
        message: "Subaccount not found",
      });
    }

    const accountSid = subaccount.accountSid;
    const authToken = subaccount.authToken;

    const client = twilio(accountSid, authToken);

    const phone = await PhoneNumber.findOne({ phoneNumber: validPhoneNumber });

    let phoneSid;

    if (phone) {
      phoneSid = phone.phoneSid;
      // Remove the phone ID from subaccount's phoneNumbers array using $pull
      await Subaccount.updateOne(
        { _id: subaccount._id },
        { $pull: { phoneNumbers: phone._id } }
      );
      await PhoneNumber.findOneAndDelete({ phoneNumber: validPhoneNumber });
    } else {
      const outgoingCallerIds = await client.outgoingCallerIds.list();
      outgoingCallerIds.forEach((o) => {
        if (o.phoneNumber === validPhoneNumber) {
          phoneSid = o.sid;
          return;
        }
      });
    }

    if (!phoneSid) {
      return res.status(404).json({
        success: false,
        message: "Phone sid not found",
      });
    }

    await client.outgoingCallerIds(phoneSid).remove();
    res.status(200).json({
      success: true,
      message: "Called id deleted",
    });
  } catch (error) {
    console.log("Error in delete caller id: ", error.message);
    res.status(500).json({
      success: false,
      message: error?.message,
    });
  }
};

const validationStatusWebhook = async (req, res) => {
  try {
    const { VerificationStatus, OutgoingCallerIdSid } = req.body;
    const { crmToken, phoneNumber, friendlyName, subaccountId } = req.query;

    console.log("valid status webhook resp: ", {
      VerificationStatus,
      OutgoingCallerIdSid,
    });

    if (VerificationStatus === "success") {
      console.log(`Validation successful for ${phoneNumber}`);

      // Save phone number details to the database
      const newPhoneNumber = new PhoneNumber({
        crmToken,
        phoneNumber,
        friendlyName,
        phoneSid: OutgoingCallerIdSid,
        capabilities: {
          voice: true,
          sms: false,
          mms: false,
          fax: false,
        },
        subaccount: subaccountId,
        status: "purchased",
        paymentStatus: "paid",
        pricePaid: "0",
      });

      const subaccount = await Subaccount.findOne({ crmToken });
      subaccount.phoneNumbers.push(newPhoneNumber._id);

      await Promise.all([newPhoneNumber.save(), subaccount.save()]);

      const { accountSid, authToken } = subaccount;

      const subaccountClient = twilio(accountSid, authToken);

      let twilioApiKey, twilioApiSecret;

      // Check for existing API keys

      const apiKey = await subaccountClient.newKeys.create({
        friendlyName: "CRM Messaging API Key",
      });
      twilioApiKey = apiKey?.sid;
      twilioApiSecret = apiKey?.secret;

      // Check or create TwiML app
      const twimlApps = await subaccountClient.applications.list({ limit: 1 });
      let twimlAppSid = twimlApps?.length > 0 ? twimlApps[0].sid : null;

      if (!twimlAppSid) {
        const twimlApp = await subaccountClient.applications.create({
          friendlyName: "CRM Messaging Voice App",
          voiceUrl: "https://voice.crm-messaging.cloud/api/voice",
          voiceMethod: "POST",
        });
        twimlAppSid = twimlApp?.sid;
      }

      // Uncomment and implement this function as necessary
      await addTwilioVoiceProvider(
        crmToken,
        phoneNumber.substring(1),
        "United States",
        twimlAppSid,
        accountSid,
        authToken,
        twilioApiKey,
        twilioApiSecret
      );

      console.log({
        newPhoneNumber,
        subaccount,
      });
    } else {
      console.log(`Validation failed for ${phoneNumber}`);
    }
  } catch (error) {
    console.log("Error in validation status webhook: ", error.message);
  }
  res.status(200).json({
    success: true,
    message: "Webhook received successfully",
  });
};

const checkValidationOfNumber = async (req, res) => {
  const crmToken = req.token;
  try {
    const { phoneNumber } = req.body;
    const validPhoneNumber = phoneNumber.startsWith("+")
      ? phoneNumber
      : `+${phoneNumber}`;

    const phone = await PhoneNumber.findOne({
      phoneNumber: validPhoneNumber,
      crmToken,
    });

    if (!phone && !phone?.phoneSid) {
      return res.status(404).json({
        success: false,
        message: "Not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "OTP Verified successfully",
    });
  } catch (error) {
    console.log("Error in check validation: ", error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// export twilio call logs
const exportCallLogs = async (req, res) => {
  const token = req.token;
  const voiceNumber = addPlusInNumber(req.query.voiceNumber);

  if (!voiceNumber) {
    return res.status(400).json({
      success: false,
      message: "voiceNumber query parameter is required",
    });
  }

  try {
    const subaccount = await Subaccount.findOne({ crmToken: token });

    if (!subaccount) {
      return res.status(404).json({
        success: false,
        message: "Subaccount not found",
      });
    }
    const accountSid = subaccount.accountSid;
    const authToken = subaccount.authToken;

    const client = twilio(accountSid, authToken);

    // Fetch all call logs
    const rawCalls = await client.calls.list();

    // Filter out unwanted calls
    const filteredCalls = rawCalls.filter(
      (c) =>
        (c.from === voiceNumber || c.to === voiceNumber) &&
        !c.from.startsWith("client:") &&
        !c.to.startsWith("client:")
    );

    const callLogs = await Promise.all(
      filteredCalls.map(async (c) => {
        const callDetail = await Call.findOne({ callSid: c.sid });
        const callPrice = callDetail?.callPrice
          ? `${callDetail?.callPrice}$`
          : "Not available";

        const direction = c.direction === "inbound" ? "incoming" : "outgoing";

        return {
          from: c.from,
          to: c.to,
          status: c.status,
          startTime: c.startTime,
          endTime: c.endTime,
          duration: c.duration,
          direction,
          callPrice,
        };
      })
    );

    // Define the fields for CSV export
    const fields = [
      { label: "To", value: "to" },
      { label: "From", value: "from" },
      { label: "Status", value: "status" },
      { label: "Start Time", value: "startTime" },
      { label: "End Time", value: "endTime" },
      { label: "Duration (s)", value: "duration" },
      { label: "Direction", value: "direction" },
      { label: "Credits", value: "callPrice" },
    ];

    // Convert JSON to CSV
    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(callLogs);

    // Set response headers for file download
    res.header("Content-Type", "text/csv");
    res.attachment("call_logs_export.csv");
    res.send(csv);
  } catch (error) {
    console.error("Error in exporting call logs:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

const exportCallLogsByToNumber = async (req, res) => {
  const token = req.token;
  const voiceNumber = addPlusInNumber(req.query.voiceNumber);
  const toNumber = addPlusInNumber(req.query.toNumber);

  if (!voiceNumber) {
    return res.status(400).json({
      success: false,
      message: "voiceNumber query parameter is required",
    });
  }

  if (!toNumber) {
    return res.status(400).json({
      success: false,
      message: "toNumber query parameter is required",
    });
  }

  try {
    const subaccount = await Subaccount.findOne({ crmToken: token });

    if (!subaccount) {
      return res.status(404).json({
        success: false,
        message: "Subaccount not found",
      });
    }

    const accountSid = subaccount.accountSid;
    const authToken = subaccount.authToken;

    const client = twilio(accountSid, authToken);

    // Fetch all calls
    const rawCalls = await client.calls.list();

    // Filter calls based on voiceNumber and toNumber
    const filteredCalls = rawCalls.filter(
      (c) =>
        (c.from === voiceNumber || c.to === voiceNumber) &&
        (c.from === toNumber || c.to === toNumber) &&
        !c.from.startsWith("client:") &&
        !c.to.startsWith("client:")
    );

    if (filteredCalls.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No call logs found for export",
      });
    }

    // Map the call data and retrieve recording URLs
    const callLogs = await Promise.all(
      filteredCalls.map(async (c) => {
        const callDetail = await Call.findOne({ callSid: c.sid });
        const callPrice = callDetail?.callPrice
          ? `${callDetail?.callPrice}$`
          : "Not available";
        // Determine call direction
        const direction = c.direction === "inbound" ? "incoming" : "outgoing";

        return {
          from: c.from,
          to: c.to,
          status: c.status,
          startTime: c.startTime,
          endTime: c.endTime,
          duration: c.duration,
          direction,
          callPrice,
        };
      })
    );

    // Define CSV fields
    const fields = [
      { label: "To", value: "to" },
      { label: "From", value: "from" },
      { label: "Status", value: "status" },
      { label: "Start Time", value: "startTime" },
      { label: "End Time", value: "endTime" },
      { label: "Duration (s)", value: "duration" },
      { label: "Direction", value: "direction" },
      { label: "Credits", value: "callPrice" },
    ];

    // Convert JSON to CSV
    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(callLogs);

    // Set headers for file download
    res.header("Content-Type", "text/csv");
    res.attachment("call_logs_export.csv");
    res.send(csv);
  } catch (error) {
    console.error("Error in exporting call logs:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to export call logs",
    });
  }
};

module.exports = {
  getCallLogs,
  getCallLogsByToNumber,
  searchAvailableNumbers,
  createSubaccountAndPurchaseNumber,
  getAllPurchasedNumbers,
  deleteSubaccount,
  getCallStatistics,
  assignPhoneNumberToTeam,
  // callerids reqs
  sendOtpValidationRequest,
  validationStatusWebhook,
  deleteOutgoingCallerId,
  checkValidationOfNumber,
  // export call logs
  exportCallLogs,
  exportCallLogsByToNumber,
};
