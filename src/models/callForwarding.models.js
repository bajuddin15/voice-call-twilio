const mongoose = require("mongoose");
const { Schema } = mongoose;

const callForwardingSchema = new Schema(
  {
    crmToken: {
      type: String,
      required: true,
    },
    isEnabled: {
      type: Boolean,
      default: false,
    },
    forwardedNumber: {
      type: String,
      required: true,
      unique: true,
    },
    toPhoneNumber: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const CallForwarding = mongoose.model("CallForwarding", callForwardingSchema);
module.exports = CallForwarding;
