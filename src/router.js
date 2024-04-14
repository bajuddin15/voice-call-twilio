const Router = require("express").Router;
const { sanitizePhoneNumber } = require("../utils/common");
const {
  tokenGenerator,
  voiceResponse,
  makeOutgoingTextToSpeechCall,
  recordingCall,
  callStatusTextToSpeech,
  callStatusWebhook,
} = require("./handler");
const TwilioAccountDetails = require("./models/twilioAccountDetails");

const router = new Router();

router.post("/token", tokenGenerator);

router.post("/voice", async (req, res) => {
  try {
    const response = await voiceResponse(req);
    res.set("Content-Type", "text/xml");
    res.send(response);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).send("Internal Server Error");
  }
});

// Text to Speech Outgoing Call
router.post("/makeTextToSpeechCall", makeOutgoingTextToSpeechCall);

// recording callback route
router.post("/recordingCallback", recordingCall);
router.post("/callStatusTextToSpeech", callStatusTextToSpeech); // for check textToSpeech call status after call end
router.post("/webhook", callStatusWebhook); // for check call status after call end

// api for updating status active/inactive from identity(number)
router.put("/updateDeviceStatus", async (req, res) => {
  const { phoneNumber, deviceStatus } = req.body;

  const newNum = sanitizePhoneNumber(phoneNumber);
  const identity = `+${newNum}`;

  try {
    const detail = await TwilioAccountDetails.findOne({ identity });

    if (!detail) {
      return res
        .status(404)
        .json({ success: false, message: "Details not found." });
    }

    detail.deviceStatus = deviceStatus;

    await detail.save();

    res.status(200).json({
      success: true,
      message: "Details updated",
    });
  } catch (error) {
    console.log("Update status error : ", error?.message);
  }
});
module.exports = router;
