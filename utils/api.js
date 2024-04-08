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

module.exports = { getProviderDetails, getTokenFromNumber, addCallRecord };