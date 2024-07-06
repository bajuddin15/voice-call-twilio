const express = require("express");
const {
  setupCallForwarding,
  setupMissedCallAction,
  getCallForwarding,
  getMissedCallAction,
  editCallForwarding,
  editMissedCallAction,
  deleteCallForwarding,
  deleteMissedCallAction,
} = require("../controllers/twilioConfig.controllers");
const { protectRoute } = require("../middlewares/auth.middlewares");

const router = express.Router();

// Prefix - /api/config
router.post("/addCallForwarding", protectRoute, setupCallForwarding);
router.post("/addMissedCallAction", protectRoute, setupMissedCallAction);

router.post("/callForwarding", protectRoute, getCallForwarding);
router.post("/missedCallAction", protectRoute, getMissedCallAction);

router.put("/updateCallForwarding/:id", protectRoute, editCallForwarding);
router.put("/updateMissedCallAction/:id", protectRoute, editMissedCallAction);

router.delete("/deleteCallForwarding/:id", protectRoute, deleteCallForwarding);
router.delete(
  "/deleteMissedCallAction/:id",
  protectRoute,
  deleteMissedCallAction
);

module.exports = router;
