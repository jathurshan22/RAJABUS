const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: true
  },

  email: {
    type: String,
    required: true,
    unique: true
  },

  phone: {
    type: String,
    required: true
  },

  password: {
    type: String,
    required: true
  },

  isVerified: {
    type: Boolean,
    default: false
  },

  // hashed random token e-mailed to the user; cleared once verified
  verificationToken: {
    type: String,
    default: null
  },

  verificationTokenExpires: {
    type: Date,
    default: null
  }

}, {
  timestamps: true
});

module.exports = mongoose.model("User", userSchema);
