const VoiceResponse = require("twilio").twiml.VoiceResponse;
const AccessToken = require("twilio").jwt.AccessToken;
const VoiceGrant = AccessToken.VoiceGrant;

const TwilioAccountDetails = require("./models/twilioAccountDetails");

const tokenGenerator = async (req, res) => {
  const {
    provider_number,
    account_sid,
    twiml_app_sid,
    twilio_api_key,
    twilio_api_secret,
  } = req.body;
  try {
    const twilioDetails = await TwilioAccountDetails.findOne({
      callerId: provider_number,
    });
    let TWILIO_ACCOUNT_DETAIL = {
      callerId: provider_number,
      accountSid: account_sid,
      twimlAppSid: twiml_app_sid,
      apiKey: twilio_api_key,
      apiSecret: twilio_api_secret,
    };

    const identity = provider_number;

    const accessToken = new AccessToken(
      TWILIO_ACCOUNT_DETAIL.accountSid,
      TWILIO_ACCOUNT_DETAIL.apiKey,
      TWILIO_ACCOUNT_DETAIL.apiSecret
    );
    accessToken.identity = identity;
    const grant = new VoiceGrant({
      outgoingApplicationSid: TWILIO_ACCOUNT_DETAIL.twimlAppSid,
      incomingAllow: true,
    });
    accessToken.addGrant(grant);

    if (!twilioDetails) {
      const newDetail = new TwilioAccountDetails({
        ...TWILIO_ACCOUNT_DETAIL,
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
          callerId: provider_number,
          accountSid: account_sid,
          twimlAppSid: twiml_app_sid,
          apiKey: twilio_api_key,
          apiSecret: twilio_api_secret,
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
    callerId: To,
  });

  const callerId = providerNumber;
  let twiml = new VoiceResponse();

  if (!providerNumber) {
    // toNumberOrClientName == twilioAccountDetailTo?.callerId
    let dial = twiml.dial();

    // This will connect the caller with your Twilio.Device/client
    const identity = twilioAccountDetailTo?.identity;
    dial.client(identity);
  } else if (To && Provider_Number) {
    // This is an outgoing call

    // set the callerId
    let dial = twiml.dial({ callerId });

    // Check if the 'To' parameter is a Phone Number or Client Name
    // in order to use the appropriate TwiML noun
    const attr = isAValidPhoneNumber(toNumberOrClientName)
      ? "number"
      : "client";
    dial[attr]({}, toNumberOrClientName);
  } else {
    twiml.say("Thanks for calling!");
  }

  return twiml.toString();
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
};
