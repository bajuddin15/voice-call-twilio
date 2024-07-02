const mongoose = require("mongoose");
const { Schema } = mongoose;

// Define the schema for phone numbers
const phoneNumberSchema = new Schema(
  {
    crmToken: {
      type: String,
      required: true,
    },
    phoneNumber: {
      type: String,
      required: true,
    },
    friendlyName: {
      type: String,
    },
    phoneSid: {
      type: String,
      unique: true,
    },
    capabilities: {
      fax: {
        type: Boolean,
        default: false,
      },
      voice: {
        type: Boolean,
        default: false,
      },
      sms: {
        type: Boolean,
        default: false,
      },
      mms: {
        type: Boolean,
        default: false,
      },
    },
    subaccount: {
      type: Schema.Types.ObjectId,
      ref: "Subaccount",
      required: true,
    },
    paymentStatus: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "purchased", "failed"],
      default: "pending",
    },
    pricePaid: {
      type: String,
      default: "0",
    },
    messagingServiceSid: {
      type: String,
    },
    memberEmail: {
      type: String,
    },
  },
  { timestamps: true }
);

// Create the Mongoose model
const PhoneNumber = mongoose.model("PhoneNumber", phoneNumberSchema);

// Export the model
module.exports = PhoneNumber;
