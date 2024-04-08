const mongoose = require("mongoose");

const twilioAccountDetailsSchema = new mongoose.Schema(
  {
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
