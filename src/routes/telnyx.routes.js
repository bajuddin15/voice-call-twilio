const express = require("express");
const FormData = require("form-data");
const { Parser } = require("json2csv");
const axios = require("axios");
const { getProviderDetails } = require("../../utils/api");
const { protectRoute } = require("../middlewares/auth.middlewares");
const { addPlusInNumber } = require("../../utils/common");

const router = express.Router();

// Prefix- /api/telnyx

router.post("/sip_credientials", async (req, res) => {
  const { crmToken, providerNumber } = req.body;
  try {
    const resData = await getProviderDetails(crmToken, providerNumber);
    if (resData && resData?.provider_name === "telnyx") {
      const sip_username = resData.twilio_api_key;
      const sip_password = resData.twilio_api_secret;
      res.status(200).json({
        success: true,
        message: "Details found",
        data: { sip_username, sip_password },
      });
    } else {
      res.status(404).json({
        success: false,
        message: "Provider details not found",
      });
    }
  } catch (error) {
    console.log("Error in telnyx get sip details: ", error?.message);
    res.status(500).json({
      success: false,
      message: error?.message,
    });
  }
});

router.post("/loginToken", async (req, res) => {
  const { crmToken, providerNumber } = req.body;
  try {
    const resData = await getProviderDetails(crmToken, providerNumber);
    if (resData && resData?.provider_name === "telnyx") {
      const API_KEY = resData?.account_token;
      const connection_id = resData?.twiml_app_sid;
      const formData = new FormData();
      formData.append("connection_id", connection_id);
      const apiUrl = "https://api.telnyx.com/v2/telephony_credentials";
      const headers = {
        Authorization: `Bearer ${API_KEY}`,
      };
      const { data } = await axios.post(apiUrl, formData, {
        headers,
      });

      if (data && data?.data) {
        const id = data?.data?.id;
        const url = `https://api.telnyx.com/v2/telephony_credentials/${id}/token`;
        const response = await axios.post(url, {}, { headers });
        if (response && response?.data) {
          res.status(200).json({
            success: true,
            message: "Token generated",
            token: response?.data,
          });
        } else {
          res.status(409).json({
            success: false,
            message: "Telnyx token not generated",
          });
        }
      } else {
        res.status(404).json({
          success: false,
          message: "Telnyx details not found",
        });
      }
    } else {
      res.status(404).json({
        success: false,
        message: "Provider details not found",
      });
    }
  } catch (error) {
    console.log("Error in telnyx get token: ", error?.message);
    res.status(500).json({
      success: false,
      message: error?.message,
    });
  }
});

router.get("/callLogs", protectRoute, async (req, res) => {
  const crmToken = req.token;
  const providerNumber = req.query.voiceNumber;
  const pageLimit = parseInt(req.query.pageLimit, 10) || 10;
  const currentPage = parseInt(req.query.currentPage, 10) || 1;
  const voiceNumber = addPlusInNumber(req.query.voiceNumber);
  const toNumber = req.query.toNumber
    ? addPlusInNumber(req.query.toNumber)
    : null;
  const resData = await getProviderDetails(crmToken, providerNumber);

  try {
    if (resData && resData?.provider_name === "telnyx") {
      const API_KEY = resData?.account_token;
      const connection_id = resData?.twiml_app_sid;
      const apiUrl = "https://api.telnyx.com/v2/recordings";
      const headers = {
        Authorization: `Bearer ${API_KEY}`,
      };

      // Construct query parameters
      const params = {
        "page[number]": currentPage,
        "page[size]": pageLimit,
        "filter[connection_id]": connection_id,
      };

      // Fetch data from Telnyx API
      const { data } = await axios.get(apiUrl, { headers, params });

      if (data && data?.data) {
        const calls = data?.data
          ?.filter((c) => {
            // Filter calls where either from or to matches the voiceNumber and toNumber (if provided)
            const isValidFrom = c.from.startsWith("+");
            const isValidTo = c.to.startsWith("+");
            const involvesVoiceNumber =
              c.from === voiceNumber || c.to === voiceNumber;
            const involvesToNumber = c.from === toNumber || c.to === toNumber;
            if (toNumber) {
              return (
                isValidFrom &&
                isValidTo &&
                involvesVoiceNumber &&
                involvesToNumber
              );
            }
            return isValidFrom && isValidTo && involvesVoiceNumber;
          })
          .map((c) => {
            const direction = c.from === voiceNumber ? "outgoing" : "incoming";
            return {
              sid: c.id,
              from: c.from,
              to: c.to,
              status: c.status,
              startTime: c.recording_started_at,
              endTime: c.recording_ended_at,
              duration: c.duration_millis
                ? Math.floor(c.duration_millis / 1000)
                : 0,
              recordingUrl: c.download_urls?.wav || null,
              direction,
            };
          });

        res.status(200).json({
          success: true,
          message: "Calls found",
          data: calls,
        });
      } else {
        res.status(404).json({
          success: false,
          message: "No call logs found",
        });
      }
    } else {
      res.status(404).json({
        success: false,
        message: "Provider details not found",
      });
    }
  } catch (error) {
    console.log("Error in telnyx call logs: ", error?.message);
    res.status(500).json({
      success: false,
      message: error?.message,
    });
  }
});

router.get("/exportTelnyxCallLogs", protectRoute, async (req, res) => {
  const crmToken = req.token;
  const providerNumber = req.query.voiceNumber;
  const voiceNumber = addPlusInNumber(req.query.voiceNumber);
  const toNumber = req.query.toNumber
    ? addPlusInNumber(req.query.toNumber)
    : null;

  if (!voiceNumber) {
    return res.status(400).json({
      success: false,
      message: "voiceNumber query parameter is required",
    });
  }

  try {
    const resData = await getProviderDetails(crmToken, providerNumber);

    if (resData?.provider_name === "telnyx") {
      const API_KEY = resData.account_token;
      const connection_id = resData.twiml_app_sid;
      const apiUrl = "https://api.telnyx.com/v2/recordings";
      const headers = {
        Authorization: `Bearer ${API_KEY}`,
      };

      // Fetch all records
      const params = {
        "page[size]": 100000, // Set large size to fetch all records in one go
        "filter[connection_id]": connection_id,
      };

      const { data } = await axios.get(apiUrl, { headers, params });

      if (data?.data?.length > 0) {
        // Filter and format the data
        const calls = data.data
          .filter((c) => {
            const isValidFrom = c.from.startsWith("+");
            const isValidTo = c.to.startsWith("+");
            const involvesVoiceNumber =
              c.from === voiceNumber || c.to === voiceNumber;
            const involvesToNumber = c.from === toNumber || c.to === toNumber;

            if (toNumber) {
              return (
                isValidFrom &&
                isValidTo &&
                involvesVoiceNumber &&
                involvesToNumber
              );
            }
            return isValidFrom && isValidTo && involvesVoiceNumber;
          })
          .map((c) => {
            const direction = c.from === voiceNumber ? "outgoing" : "incoming";
            return {
              sid: c.id,
              from: c.from,
              to: c.to,
              status: c.status,
              startTime: c.recording_started_at,
              endTime: c.recording_ended_at,
              duration: c.duration_millis
                ? Math.floor(c.duration_millis / 1000)
                : 0,
              recordingUrl: c.download_urls?.wav || null,
              direction,
              callPrice: "Not available",
            };
          });

        // Define the fields for CSV export
        const fields = [
          { label: "To", value: "to" },
          { label: "From", value: "from" },
          { label: "Status", value: "status" },
          { label: "Start Time", value: "startTime" },
          { label: "End Time", value: "endTime" },
          { label: "Duration", value: "duration" },
          { label: "Direction", value: "direction" },
          { label: "Credits", value: "callPrice" },
        ];

        // Convert the data into CSV format using Parser
        const json2csvParser = new Parser({ fields });
        const csv = json2csvParser.parse(calls);

        // Set response headers for CSV download
        res.header("Content-Type", "text/csv");
        res.attachment("telnyx_call_logs.csv");
        return res.status(200).send(csv);
      } else {
        return res.status(404).json({
          success: false,
          message: "No call logs found",
        });
      }
    } else {
      return res.status(404).json({
        success: false,
        message: "Provider details not found",
      });
    }
  } catch (error) {
    console.error("Error in exporting Telnyx call logs:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to export call logs",
    });
  }
});

// TODO: Start Recording
router.post("/startRecording", async (req, res) => {
  try {
  } catch (error) {
    console.log("Error in start recording: ", error?.message);
    res.status(500).json({
      success: false,
      message: error?.message,
    });
  }
});

// TODO: Stop Recording

module.exports = router;
