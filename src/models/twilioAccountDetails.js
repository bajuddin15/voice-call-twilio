const mongoose = require("mongoose");

const twilioAccountDetailsSchema = new mongoose.Schema(
  {
    callerId: {
      type: String,
      required: true,
      unique: true,
    },
    accountSid: {
      type: String,
      required: true,
    },
    twimlAppSid: {
      type: String,
      required: true,
    },
    apiKey: {
      type: String,
      required: true,
    },
    apiSecret: {
      type: String,
      required: true,
    },
    identity: {
      type: String,
      required: true,
    },
    token: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const TwilioAccountDetails = mongoose.model(
  "TwilioAccountDetails",
  twilioAccountDetailsSchema
);
module.exports = TwilioAccountDetails;
