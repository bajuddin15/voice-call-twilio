const mongoose = require("mongoose");
const { Schema } = mongoose;

const callSchema = new Schema(
  {
    callSid: {
      type: String,
    },
    parentCallSid: {
      type: String,
    },
    accountSid: {
      type: String,
    },
    to: {
      type: String,
    },
    from: {
      type: String,
    },
    recordingUrl: {
      type: String,
      default: "",
    },
    duration: {
      type: String,
    },
    direction: {
      type: String,
    },
    callPrice: {
      type: String,
    },
    parentCallPrice: {
      type: String,
    },
    currency: {
      type: String,
    },
    totalPrice: {
      type: String,
    },
    status: {
      type: String,
    },
    startTime: {
      type: String,
    },
    endTime: {
      type: String,
    },
  },
  { timestamps: true }
);

const Call = mongoose.model("Call", callSchema);
module.exports = Call;
