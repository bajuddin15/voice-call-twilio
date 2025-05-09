const Router = require("express").Router;
const { sanitizePhoneNumber } = require("../utils/common");
const {
  tokenGenerator,
  voiceResponse,
  makeOutgoingTextToSpeechCall,
  recordingCall,
  callStatusTextToSpeech,
  callStatusWebhook,
  confrenceCallStatusWebhook,
  makeConfrenceCall,
  myOperatorCallWebhook,
  makeMyOperatorCall,
  checkMyOperatorCallStatus,
  myOperatorCallLogs,
} = require("./handler");
const TwilioAccountDetails = require("./models/twilioAccountDetails");
const { protectRoute } = require("./middlewares/auth.middlewares");
const {
  getCallLogs,
  searchAvailableNumbers,
  createSubaccountAndPurchaseNumber,
  getAllPurchasedNumbers,
  deleteSubaccount,
  getCallStatistics,
  assignPhoneNumberToTeam,
  getCallLogsByToNumber,
  sendOtpValidationRequest,
  deleteOutgoingCallerId,
  validationStatusWebhook,
  checkValidationOfNumber,
  exportCallLogs,
  exportCallLogsByToNumber,
} = require("./controllers/dialer.controllers");

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
router.all("/callStatusTextToSpeech", callStatusTextToSpeech); // for check textToSpeech call status after call end
router.post("/webhook", callStatusWebhook); // for check call status after call end

// Confrence call
router.post("/makeConfrenceCall", protectRoute, makeConfrenceCall);
router.all("/twilioConfrenceCallWebhook", confrenceCallStatusWebhook);

// My Operator call
router.post("/makeMyOperatorCall", makeMyOperatorCall);
router.post("/checkMyOperatorCallStatus", checkMyOperatorCallStatus);
router.get("/myOperatorCallLogs", protectRoute, myOperatorCallLogs);
router.all("/myOperatorCallWebhook", myOperatorCallWebhook);

// api for updating status active/inactive from identity(number)
router.put("/updateDeviceStatus", async (req, res) => {
  const { phoneNumber, deviceStatus } = req.body;

  const newNum = sanitizePhoneNumber(phoneNumber);
  const identity = `+${newNum}`;

  try {
    const detail = await TwilioAccountDetails.findOne({ identity });
    // console.log("Detail found:", detail);

    if (!detail) {
      return res
        .status(404)
        .json({ success: false, message: "Details not found." });
    }

    detail.deviceStatus = deviceStatus;
    const savedDetail = await detail.save();
    // console.log("Updated detail:", savedDetail);

    res.status(200).json({
      success: true,
      message: "Details updated",
      data: savedDetail,
    });
  } catch (error) {
    console.error("Update status error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// api for retrive call logs
router.get("/callLogs", protectRoute, getCallLogs);
router.get("/callLogsByToNumber", protectRoute, getCallLogsByToNumber);
router.post("/searchNumbers", searchAvailableNumbers);
router.post("/purchaseNumber", protectRoute, createSubaccountAndPurchaseNumber);
router.get("/purchasedNumbers", protectRoute, getAllPurchasedNumbers);
router.get("/calls/states", protectRoute, getCallStatistics);
router.delete("/delete-subaccount", deleteSubaccount);

// export call logs
router.get("/exportCallLogs", protectRoute, exportCallLogs);
router.get("/exportCallLogsByToNumber", protectRoute, exportCallLogsByToNumber);

router.put(
  "/assignPhoneNumber/:phoneSid",
  protectRoute,
  assignPhoneNumberToTeam
);

// caller id apis
router.post("/sendOtpOfCallerId", protectRoute, sendOtpValidationRequest);
router.post("/otpValidationStatus", validationStatusWebhook);
router.post("/deleteOutgoingCallerId", protectRoute, deleteOutgoingCallerId);
router.post("/checkValidationOfNumber", protectRoute, checkValidationOfNumber);

module.exports = router;
