const mongoose = require("mongoose");
const { Schema } = mongoose;

// Utility for email validation
const emailValidator = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const subaccountSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      validate: [emailValidator, "Invalid email format"],
    },
    crmToken: {
      type: String,
      default: "",
      required: true, // Ensure this field is required
      index: true, // Add index
    },
    accountSid: {
      type: String,
      required: true,
      index: true, // Add index
    },
    authToken: {
      type: String,
      required: true,
    },
    phoneNumbers: [
      {
        type: Schema.Types.ObjectId,
        ref: "PhoneNumber",
      },
    ],
    credits: {
      type: Number,
      required: true,
      default: 0,
    },
    status: {
      type: String,
      enum: ["active", "inactive", "suspended"],
      default: "active",
    },
    metadata: {
      type: Map,
      of: String,
      default: {},
    },
  },
  { timestamps: true }
);

// Ensure the email is unique and case insensitive
subaccountSchema.index(
  { email: 1 },
  { unique: true, collation: { locale: "en", strength: 2 } }
);

// Add compound indexes to ensure unique crmToken and accountSid
subaccountSchema.index({ crmToken: 1, accountSid: 1 }, { unique: true });

const Subaccount = mongoose.model("Subaccount", subaccountSchema);

module.exports = Subaccount;
