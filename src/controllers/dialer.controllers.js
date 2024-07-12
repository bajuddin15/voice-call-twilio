const twilio = require("twilio");
const moment = require("moment");
const {
  addTwilioSmsProvider,
  addTwilioVoiceProvider,
} = require("../../utils/api");
const Subaccount = require("../models/subaccount.models");
const PhoneNumber = require("../models/phoneNumber.models");
const { formatAverageCallsDuration } = require("../../utils/common");

const getCallLogs = async (req, res) => {
  const token = req.token;

  // Extract pageLimit, currentPage, and voiceNumber from query parameters, with defaults
  const pageLimit = parseInt(req.query.pageLimit, 10) || 10;
  const currentPage = parseInt(req.query.currentPage, 10) || 1;
  const voiceNumber = `+${req.query.voiceNumber}`;

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
    const fetchLimit = pageLimit * 4; // Adjust as needed to ensure sufficient results after filtering
    const rawCalls = await client.calls.list({ limit: fetchLimit });

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
        const recordingUrl =
          recordings.length > 0
            ? `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Recordings/${recordings[0].sid}`
            : null;

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
    const client = require("twilio")(accountSid, authToken);

    // Step 1: Check if subaccount already exists
    let subaccount;
    let subaccountSid;
    let subaccountAuthToken;
    const existingSubaccount = await Subaccount.findOne({ email });
    if (existingSubaccount) {
      subaccount = existingSubaccount;
      subaccountSid = subaccount.accountSid;
      subaccountAuthToken = subaccount.authToken;
    } else {
      // Step 2: Create Subaccount
      subaccount = await client.api.accounts.create({
        friendlyName: email,
      });
      subaccountSid = subaccount.sid;
      subaccountAuthToken = subaccount.authToken;

      // if subaccount not created
      if (!subaccount) {
        return res.status(409).json({
          success: false,
          message: "Subaccount not created",
        });
      }
    }

    // Step 3: Verify the phone number
    try {
      await client.validationRequests.create({
        phoneNumber: phoneNumber,
        friendlyName: email,
      });
    } catch (error) {
      // Handle error response
      if (!existingSubaccount) {
        subaccount = new Subaccount({
          email: email,
          crmToken: crmToken,
          accountSid: subaccountSid,
          authToken: subaccountAuthToken,
        });
      }
      console.error("Error verifying phone number: ", error?.message);
      return res.status(400).json({
        success: false,
        message: "Failed to verify phone number",
      });
    }

    // Step 4: Purchase Number
    let purchasedNumber;
    let phoneNumberStatus = "pending";
    let messagingServiceSid;
    let twimlAppSid;

    try {
      const subaccountClient = require("twilio")(
        subaccountSid,
        subaccountAuthToken
      );

      // Check if a TwiML app exists, else create one
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

      // Check if a messaging service exists, else create one
      const messagingServices = await subaccountClient.messaging.services.list({
        limit: 1,
      });
      if (messagingServices.length > 0) {
        messagingServiceSid = messagingServices[0].sid;
      } else {
        let messagingService = await subaccountClient.messaging.services.create(
          {
            friendlyName: "CRM Messaging Service",
          }
        );

        messagingService = await subaccountClient.messaging
          .services(messagingService.sid)
          .update({
            inboundRequestUrl:
              "https://app.crm-messaging.cloud/index.php/Message/getMessageTwillio",
            inboundMethod: "POST",
          });

        messagingServiceSid = messagingService.sid;
      }

      // Purchase number and configure voice webhook
      purchasedNumber = await subaccountClient.incomingPhoneNumbers.create({
        phoneNumber: phoneNumber,
      });

      // Map the phone number to the messaging service first
      await subaccountClient.incomingPhoneNumbers(purchasedNumber.sid).update({
        messagingServiceSid: messagingServiceSid,
      });

      // Then map the phone number to the TwiML app
      await subaccountClient.incomingPhoneNumbers(purchasedNumber.sid).update({
        voiceApplicationSid: twimlAppSid,
      });

      console.log("Message service sid map with phoneNumber");

      // Fetch detailed information about the purchased number using Lookup API
      const lookupResult = await client.lookups
        .phoneNumbers(purchasedNumber.phoneNumber)
        .fetch();
      const phoneNumberCountry = lookupResult.countryCode; // Example: 'US'

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

      // Handle error response
      if (!existingSubaccount) {
        subaccount = new Subaccount({
          email: email,
          crmToken: crmToken,
          accountSid: subaccountSid,
          authToken: subaccountAuthToken,
        });
      }

      return res.status(409).json({
        success: false,
        message: "Number not purchased",
      });
    }

    // Step 5: Save subaccount and phone number details to your database
    if (!existingSubaccount) {
      subaccount = new Subaccount({
        email: email,
        crmToken: crmToken,
        accountSid: subaccountSid,
        authToken: subaccountAuthToken,
      });
    }

    const newPhoneNumber = new PhoneNumber({
      crmToken: crmToken,
      phoneNumber: phoneNumber,
      friendlyName: purchasedNumber ? purchasedNumber.friendlyName : null,
      phoneSid: purchasedNumber ? purchasedNumber.sid : null,
      capabilities: purchasedNumber ? purchasedNumber.capabilities : {},
      subaccount: subaccount._id,
      status: phoneNumberStatus,
      paymentStatus,
      pricePaid,
    });

    subaccount.phoneNumbers.push(newPhoneNumber._id);

    await subaccount.save();
    await newPhoneNumber.save();

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

module.exports = {
  getCallLogs,
  searchAvailableNumbers,
  createSubaccountAndPurchaseNumber,
  getAllPurchasedNumbers,
  deleteSubaccount,
  getCallStatistics,
  assignPhoneNumberToTeam,
};
