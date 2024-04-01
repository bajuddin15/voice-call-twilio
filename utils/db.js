const mongoose = require("mongoose");

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;
  try {
    const res = await mongoose.connect(uri);
    console.log(`MongoDB connected successfully.`);
  } catch (error) {
    console.log("MongoDB connection error : ", error?.message);
  }
};

module.exports = connectDB;
