const FormData = require("form-data");
const axios = require("axios");

const getProviderDetails = async (token, providerNumber) => {
  const url =
    "https://app.crm-messaging.cloud/index.php/api/fetchProviderDetails";

  const headers = {
    Authorization: `Bearer ${token}`,
  };

  const formData = new FormData();
  formData.append("provider_number", providerNumber);

  let resData;
  try {
    const { data } = await axios.post(url, formData, {
      headers,
    });
    resData = data;
  } catch (error) {
    console.log("Provider details fetch err : ", error);
    resData = null;
  }
  return resData;
};

const getTokenFromNumber = async (number) => {
  const getTokenUri = `https://app.crm-messaging.cloud/index.php/api/fetch-token?provider_number=${number}`;
  let token;
  try {
    const { data } = await axios.get(getTokenUri);
    token = data?.token;
  } catch (error) {
    console.error("Error fetching token:", error);
    token = null;
  }
  return token;
};

const addCallRecord = async (token, callDetails) => {
  const {
    to,
    from,
    recordingUrl,
    callDuration,
    callDirection,
    price,
    currency,
    callSid,
  } = callDetails;
  const url = "https://app.crm-messaging.cloud/index.php/api/addCallRecord";

  const headers = {
    Authorization: `Bearer ${token}`,
  };

  const formData = new FormData();
  formData.append("to", to);
  formData.append("from", from);
  formData.append("url", recordingUrl);
  formData.append("call_duration", callDuration);
  formData.append("call_direction", callDirection);
  formData.append("price", price);
  formData.append("currency", currency);
  formData.append("callSid", callSid);
  // another callsid

  let resData;
  try {
    const { data } = await axios.post(url, formData, {
      headers,
    });
    resData = data;
  } catch (error) {
    console.log("Add call record error : ", error);
    resData = null;
  }
  return resData;
};

const getVoiceCallMsg = async (token) => {
  const url = "https://app.crm-messaging.cloud/index.php/Api/getVoiceMessage";
  const headers = {
    Authorization: `Bearer ${token}`,
  };
  let resData;
  try {
    const { data } = await axios.get(url, {
      headers,
    });
    resData = data;
  } catch (error) {
    console.log("Get voice msg error : ", error);
    resData = null;
  }
  return resData;
};

// add sms provider
const addTwilioSmsProvider = async (
  token,
  phoneNumber,
  country,
  msgServiceId,
  accountSid,
  accountToken
) => {
  const url =
    "https://app.crm-messaging.cloud/index.php/Api/addTwilioSmsProvider";

  const headers = {
    Authorization: `Bearer ${token}`,
  };

  const formData = new FormData();
  formData.append("token", token);
  formData.append("phoneNumber", phoneNumber);
  formData.append("country", country);
  formData.append("msgServiceId", msgServiceId);
  formData.append("account_sid", accountSid);
  formData.append("account_token", accountToken);

  let resData;
  try {
    const { data } = await axios.post(url, formData, {
      headers,
    });
    resData = data;
  } catch (error) {
    console.log("Add Twilio SMS provider error:", error);
    resData = null;
  }

  return resData;
};
const addTwilioVoiceProvider = async (
  token,
  phoneNumber,
  country,
  twimlAppSid,
  accountSid,
  accountToken,
  apiKey,
  apiSecret
) => {
  const url =
    "https://app.crm-messaging.cloud/index.php/Api/addTwilioVoiceProvider";

  const headers = {
    Authorization: `Bearer ${token}`,
  };

  const formData = new FormData();
  formData.append("token", token);
  formData.append("phoneNumber", phoneNumber);
  formData.append("country", country);
  formData.append("twiml_app_sid", twimlAppSid);
  formData.append("account_sid", accountSid);
  formData.append("account_token", accountToken);
  formData.append("twilio_api_key", apiKey);
  formData.append("twilio_api_secret", apiSecret);

  let resData;
  try {
    const { data } = await axios.post(url, formData, {
      headers,
    });
    resData = data;
  } catch (error) {
    console.log("Add Twilio voice provider error:", error);
    resData = null;
  }

  return resData;
};

module.exports = {
  getProviderDetails,
  getTokenFromNumber,
  addCallRecord,
  getVoiceCallMsg,
  addTwilioSmsProvider,
  addTwilioVoiceProvider,
};
