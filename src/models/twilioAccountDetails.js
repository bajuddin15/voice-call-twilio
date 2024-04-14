const mongoose = require("mongoose");
const { DEVICE_STATUS } = require("../../utils/constants");

const twilioAccountDetailsSchema = new mongoose.Schema(
  {
    identity: {
      type: String,
      required: true,
      unique: true,
    },
    token: {
      type: String,
      required: true,
    },
    deviceStatus: {
      type: String,
      enum: [DEVICE_STATUS.ACTIVE, DEVICE_STATUS.INACTIVE],
      default: DEVICE_STATUS.INACTIVE,
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
