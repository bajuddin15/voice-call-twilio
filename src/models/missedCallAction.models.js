const mongoose = require("mongoose");
const { Schema } = mongoose;

const missedCallActionSchema = new Schema(
  {
    // missed or busy call
    crmToken: {
      type: String,
      required: true,
    },
    actionType: {
      type: String,
      enum: ["sms", "whatsapp", ""],
      default: "",
    },
    applyNumber: {
      type: String,
      required: true,
      unique: true,
    },
    fromNumber: {
      type: String,
    },
    message: {
      type: String,
    },
    templateName: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

const MissedCallAction = mongoose.model(
  "MissedCallAction",
  missedCallActionSchema
);
module.exports = MissedCallAction;
