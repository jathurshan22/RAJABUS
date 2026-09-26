const mongoose = require("mongoose");

// One document = one seat for one bus on one journey date.
//
// Unique index:
// same bus + same date + same seat
// rendu users ஒரே நேரத்தில் reserve panna prevent pannum.

const seatLockSchema = new mongoose.Schema(
  {
    // --------------------------------------------------
    // BUS
    // --------------------------------------------------
    busId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bus",
      required: true,
      index: true,
    },

    // --------------------------------------------------
    // JOURNEY DATE
    // Example: "2026-09-30"
    // --------------------------------------------------
    journeyDate: {
      type: String,
      required: true,
      index: true,
    },

    // --------------------------------------------------
    // SEAT NUMBER
    // Example: "18", "A1"
    // --------------------------------------------------
    seat: {
      type: String,
      required: true,
      trim: true,
    },

    // --------------------------------------------------
    // BOOKING
    // --------------------------------------------------
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
      index: true,
    },

    // --------------------------------------------------
    // USER WHO HOLDS / BOOKS THIS SEAT
    // --------------------------------------------------
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // --------------------------------------------------
    // SEAT STATUS
    //
    // held:
    // Passenger details submitted.
    // Payment not completed yet.
    // UI = ORANGE
    //
    // booked:
    // Payment successfully completed.
    // UI = RED
    // --------------------------------------------------
    status: {
      type: String,
      enum: ["held", "booked"],
      default: "held",
      required: true,
      index: true,
    },

    // --------------------------------------------------
    // HOLD EXPIRY
    //
    // When status = held:
    // current time + 15 minutes
    //
    // When status = booked:
    // null
    // --------------------------------------------------
    expiresAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);


// ======================================================
// PREVENT DOUBLE BOOKING / DOUBLE HOLD
// ======================================================
//
// Example:
// Bus A + 2026-09-30 + Seat 18
// can only have ONE SeatLock document.
//
// User 2 trying same seat gets duplicate-key error.
//
seatLockSchema.index(
  {
    busId: 1,
    journeyDate: 1,
    seat: 1,
  },
  {
    unique: true,
  }
);


// ======================================================
// FAST EXPIRED-HOLD SEARCH
// ======================================================
//
// holdCleanup.js later use pannum:
//
// status = held
// expiresAt <= current time
//
seatLockSchema.index({
  status: 1,
  expiresAt: 1,
});


// ======================================================
// MODEL
// ======================================================

module.exports = mongoose.model(
  "SeatLock",
  seatLockSchema
);