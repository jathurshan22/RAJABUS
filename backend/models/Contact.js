
"use strict";

const mongoose = require("mongoose");

const contactSchema = new mongoose.Schema(
  {
    // PERMANENT RAJABUS MESSAGE ID
    // RBM0001, RBM0002, RBM0003...

    messageCode: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      match: /^RBM\d{4,}$/
    },

    name: {
      type: String,
      required: true,
      trim: true
    },

    email: {
      type: String,
      required: true,
      trim: true
    },

    subject: {
      type: String,
      trim: true,
      default: ""
    },

    message: {
      type: String,
      required: true,
      trim: true
    },

    isRead: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model(
  "Contact",
  contactSchema
);
