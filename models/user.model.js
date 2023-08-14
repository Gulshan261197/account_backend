import mongoose from "mongoose";

export const User = mongoose.model(
  "User",
  new mongoose.Schema({
    firstname: { type: String, required: true },
    lastname: { type: String, required: true },
    email: { type: String, required: true },
    password: { type: String, required: true },
    contactNumber : { type:Number, required: true },
    emailVerified: { type: Boolean, default: false },
    wallet: { type: Number},
    profilePicture: { type: String },
    role: { type: String, default: "user" },
    bankDetail: {
      accountHolderName: { type: String },
      bankName: { type: String },
      accountNumber: { type: Number },
      ifscCode: { type: String },
    },
    upiDetail: {
      upiId: { type: String },
      upiApp: { type: String }
    },
    webSiteDetail: [],
    tokens: {
      emailVerification: { type: String },
      passwordReset: { type: String },
    }
  }),
  "users"
);