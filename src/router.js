const Router = require("express").Router;
const {
  tokenGenerator,
  voiceResponse,
  makeOutgoingTextToSpeechCall,
  recordingCall,
  callStatusTextToSpeech,
  callStatusWebhook,
} = require("./handler");

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
module.exports = router;
