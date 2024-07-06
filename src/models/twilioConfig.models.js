const mongoose = require("mongoose");
const { Schema } = mongoose;

const twilioConfigSchema = new Schema(
  {
    crmToken: {
      type: String,
      unique: true,
      required: true,
    },
    callForwarding: [
      {
        type: Schema.Types.ObjectId,
        ref: "CallForwarding",
      },
    ],
    missedCallAction: [
      {
        type: Schema.Types.ObjectId,
        ref: "MissedCallAction",
      },
    ],
  },
  {
    timestamps: true,
  }
);

const TwilioConfig = mongoose.model("TwilioConfig", twilioConfigSchema);
module.exports = TwilioConfig;
