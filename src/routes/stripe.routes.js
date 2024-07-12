const express = require("express");
const {
  // createCheckoutSession,
  sessionStatus,
  createSubscriptionSession,
} = require("../controllers/stripe.controller");
const { protectRoute } = require("../middlewares/auth.middlewares");

const router = express.Router();

// router.post("/create-checkout-session", protectRoute, createCheckoutSession);
router.post(
  "/create-checkout-session",
  protectRoute,
  createSubscriptionSession
);
router.get("/session-status", sessionStatus);

module.exports = router;
