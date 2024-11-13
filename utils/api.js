const FormData = require("form-data");
const axios = require("axios");
const moment = require("moment");
const { sanitizePhoneNumber } = require("./common");

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

const sendMessage = async (token, msgData) => {
  const { toNumber, fromNumber, message, templateName } = msgData;
  let resData;
  try {
    let channel = msgData?.actionType === "whatsapp" ? "whatsapp" : "sms";
    let fromnum = sanitizePhoneNumber(fromNumber);
    const formData = new FormData();
    formData.append("to", toNumber);
    formData.append("fromnum", fromnum);
    formData.append("msg", message);
    formData.append("channel", channel);

    if (channel === "whatsapp") {
      formData.append("tempName", templateName);
    }
    const url = "https://app.crm-messaging.cloud/index.php/Api/sendMsg";
    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded",
    };

    const { data } = await axios.post(url, formData, { headers });
    resData = data;
  } catch (error) {
    console.log("Send Message Error: ", error?.message);
    resData = null;
  }
  return resData;
};

const getProfileByToken = async (token) => {
  const url = "https://app.crm-messaging.cloud/index.php/Api/getProfileInfo";

  const headers = {
    Authorization: `Bearer ${token}`,
  };

  let resData;
  try {
    const { data } = await axios.get(url, { headers });
    resData = data;
  } catch (error) {
    resData = null;
  }
  return resData;
};

const getCRMConfig = async (token) => {
  let resData = null;
  try {
    const { data } = await axios.get(
      `https://campaigns.crm-messaging.cloud/api/config`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    console.log({ data });
    if (data && data?.success) {
      resData = data.data;
    }
  } catch (error) {
    console.log("Error in get config: ", error?.message);
  }
  return resData;
};

const getZohoAccessToken = async (refreshToken, accountServer) => {
  const client_id = process.env.ZOHO_CLIENT_ID;
  const client_secret = process.env.ZOHO_CLIENT_SECRET;
  try {
    const url = `${accountServer}/oauth/v2/token`;
    const response = await axios.post(
      url,
      new URLSearchParams({
        grant_type: "refresh_token",
        client_id,
        client_secret,
        refresh_token: refreshToken,
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error("Error refreshing access token:", error);
    return null;
  }
};

const formatDurationForZoho = (seconds) => {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;

  // Pad with leading zeros to ensure two-digit format
  const formattedMinutes = String(minutes).padStart(2, "0");
  const formattedSeconds = String(secs).padStart(2, "0");

  return `${formattedMinutes}:${formattedSeconds}`;
};

const removeMillisecondsForZoho = (dateTimeString) => {
  if (!dateTimeString) return "";
  return moment(dateTimeString).utc().format("YYYY-MM-DDTHH:mm:ss[Z]");
};

const createCallRecordInZoho = async ({
  subject,
  callType,
  callPurpose,
  callFrom,
  relatedTo,
  callDetails,
  callStartTime,
  callDuration,
  description,
  billable,
  callResult,
  crmToken,
  providerNumber,
  findZohoNumber,
}) => {
  const duration = formatDurationForZoho(callDuration);
  const startTime = removeMillisecondsForZoho(callStartTime);

  // zohoApiDomain = https://www.zohoapis.com
  try {
    console.log({ crmToken, startTime });
    // Step. 1 Find config and zoho token is it exist or not
    const configData = await getCRMConfig(crmToken);
    if (!configData) {
      console.log("Zoho refreshToken config not found");
      return null;
    }
    const zohoRefreshToken = configData.zohoRefreshToken;
    const zohoAccountServer = configData.zohoAccountServer;
    const zohoApiDomain = configData.zohoApiDomain;

    const accessTokenResp = await getZohoAccessToken(
      zohoRefreshToken,
      zohoAccountServer
    );
    const zohoAccessToken = accessTokenResp.access_token;

    const findLead = await findLeadByPhoneInZoho(
      findZohoNumber,
      zohoAccessToken,
      zohoApiDomain
    );
    const findContact = await findContactByPhoneInZoho(
      findZohoNumber,
      zohoAccessToken,
      zohoApiDomain
    );
    console.log({
      findZohoNumber,
      findLead,
      findContact,
      zohoAccessToken,
    });

    if (findLead) {
      const leadData = findLead.data;
      for (const item of leadData) {
        const leadId = item.id;
        let response = await axios.post(
          `${zohoApiDomain}/crm/v2/Calls`,
          {
            data: [
              {
                Subject: subject,
                Call_Type: callType,
                Call_Purpose: callPurpose,
                Call_From: callFrom,
                Related_To: leadId, // use lead ID for "Leads"
                Call_Details: callDetails,
                Call_Start_Time: startTime,
                Call_Duration: duration,
                Description: description,
                Billable: billable,
                Call_Result: callResult,
                What_Id: leadId,
                $se_module: "Leads", // Specify module if linking to a lead
              },
            ],
          },
          {
            headers: {
              Authorization: `Zoho-oauthtoken ${zohoAccessToken}`,
              "Content-Type": "application/json",
            },
          }
        );
        console.log("Zoho call record added successfully for lead: ", {
          response: response.data.data,
          Payload: {
            Subject: subject,
            Call_Type: callType,
            Call_Purpose: callPurpose,
            Call_From: callFrom,
            Related_To: leadId, // use lead ID for "Leads"
            Call_Details: callDetails,
            Call_Start_Time: startTime,
            Call_Duration: duration,
            Description: description,
            Billable: billable,
            Call_Result: callResult,
            What_Id: leadId,
            $se_module: "Leads",
          },
        });
      }
    }
    if (findContact) {
      const contactData = findContact.data; // it will array of contacts

      for (const item of contactData) {
        const contactId = item.id;
        let response = await axios.post(
          `${zohoApiDomain}/crm/v2/Calls`,
          {
            data: [
              {
                Subject: subject,
                Call_Type: callType,
                Call_Purpose: callPurpose,
                Call_From: callFrom,
                Related_To: contactId, // use lead ID for "Leads"
                Call_Details: callDetails,
                Call_Start_Time: startTime,
                Call_Duration: duration,
                Description: description,
                Billable: billable,
                Call_Result: callResult,
                Who_Id: contactId,
                // $se_module: "Contacts", // Specify module if linking to a lead
              },
            ],
          },
          {
            headers: {
              Authorization: `Zoho-oauthtoken ${zohoAccessToken}`,
              "Content-Type": "application/json",
            },
          }
        );
        console.log("Zoho call record added successfully for contact: ", {
          response: response.data.data,
          Payload: {
            Subject: subject,
            Call_Type: callType,
            Call_Purpose: callPurpose,
            Call_From: callFrom,
            Related_To: contactId, // use lead ID for "Leads"
            Call_Details: callDetails,
            Call_Start_Time: startTime,
            Call_Duration: duration,
            Description: description,
            Billable: billable,
            Call_Result: callResult,
            Who_Id: contactId,
          },
        });
      }
    }
  } catch (error) {
    console.error("Error creating call record:", error?.message);
  }
};
const findLeadByPhoneInZoho = async (
  phoneNumber,
  zohoAccessToken,
  zohoApiDomain
) => {
  try {
    const withoutPlusNumber = sanitizePhoneNumber(phoneNumber);
    const response = await axios.get(
      `${zohoApiDomain}/crm/v2/Leads/search?criteria=(((Phone:equals:${phoneNumber}) or (Mobile:equals:${phoneNumber})) or ((Phone:equals:${withoutPlusNumber}) or (Mobile:equals:${withoutPlusNumber})))`,
      {
        headers: {
          Authorization: `Zoho-oauthtoken ${zohoAccessToken}`,
          "Content-Type": "application/json",
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error("Error finding lead by phone number:", error.response.data);
    throw error;
  }
};
const findContactByPhoneInZoho = async (
  phoneNumber,
  zohoAccessToken,
  zohoApiDomain
) => {
  try {
    const withoutPlusNumber = sanitizePhoneNumber(phoneNumber);
    const response = await axios.post(
      `${zohoApiDomain}/crm/v2/coql`,
      {
        select_query: `select id, First_Name, Last_Name, Phone, Mobile from Contacts where (Phone = '${phoneNumber}' or Mobile = '${phoneNumber}') or (Phone = '${withoutPlusNumber}' or Mobile = '${withoutPlusNumber}')`,
      },
      {
        headers: {
          Authorization: `Zoho-oauthtoken ${zohoAccessToken}`,
          "Content-Type": "application/json",
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error(
      "Error finding contact by phone number:",
      error.response.data
    );
    throw error;
  }
};

module.exports = {
  getProviderDetails,
  getTokenFromNumber,
  addCallRecord,
  getVoiceCallMsg,
  addTwilioSmsProvider,
  addTwilioVoiceProvider,
  sendMessage,
  getProfileByToken,
  createCallRecordInZoho,
  findLeadByPhoneInZoho,
  findContactByPhoneInZoho,
};
