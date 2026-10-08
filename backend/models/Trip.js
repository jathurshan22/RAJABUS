
const mongoose = require("mongoose");

// ======================================================
// TRIP MODEL - RAJABUS
// ======================================================

const tripSchema = new mongoose.Schema(
  {
    operatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Operator",
      required: true,
      index: true,
    },

    busId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bus",
      required: true,
      index: true,
    },

    journeyDate: {
      type: String,
      required: true,
      trim: true,
    },

    from: {
      type: String,
      required: true,
      trim: true,
    },

    to: {
      type: String,
      required: true,
      trim: true,
    },

    departureTime: {
      type: String,
      required: true,
      trim: true,
    },

    arrivalTime: {
      type: String,
      required: true,
      trim: true,
    },

    fare: {
      type: Number,
      required: true,
      min: 0,
    },

    status: {
      type: String,
      enum: [
        "Active",
        "Cancelled",
        "Completed",
      ],
      default: "Active",
    },
  },
  {
    timestamps: true,
  }
);

// ======================================================
// PREVENT DUPLICATE TRIPS
//
// Same bus + same date + same departure time
// ======================================================

tripSchema.index(
  {
    busId: 1,
    journeyDate: 1,
    departureTime: 1,
  },
  {
    unique: true,
  }
);

// ======================================================
// EXPORT MONGOOSE MODEL
// ======================================================

module.exports = mongoose.model("Trip", tripSchema);
