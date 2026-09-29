const mongoose = require("mongoose");

// ======================================================
// SEAT LOCK
//
// One document = one seat for one bus + journey date.
//
// AVAILABLE
//    ↓ user clicks
// HELD
//    ↓ payment successful
// BOOKED
//
// HELD:
// temporary online selection
// UI for other users = ORANGE
//
// BOOKED:
// payment completed
// UI = RED
// ======================================================

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
    //
    // Example:
    // "2026-09-30"
    // --------------------------------------------------

    journeyDate: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },


    // --------------------------------------------------
    // SEAT NUMBER
    //
    // Example:
    // "18"
    // "A1"
    // --------------------------------------------------

    seat: {
      type: String,
      required: true,
      trim: true,
    },


    // --------------------------------------------------
    // USER
    //
    // Which logged-in user selected this seat.
    // --------------------------------------------------

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },


    // --------------------------------------------------
    // SELECTION ID
    //
    // Browser generates this when seat modal opens.
    //
    // Example:
    // crypto.randomUUID()
    //
    // Important:
    // Same user's own SSE event identify panna use aagum.
    //
    // Passenger 1:
    // selectionId matches → keep seat GREEN
    //
    // Passenger 2:
    // selectionId different → show ORANGE
    // --------------------------------------------------

    selectionId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },


    // --------------------------------------------------
    // BOOKING
    //
    // Seat click pannumbodhu booking இன்னும் create
    // aagala.
    //
    // So initially:
    // bookingId = null
    //
    // Passenger details submit pannumbodhu:
    // bookingId = created Booking ID
    // --------------------------------------------------

    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      default: null,
      index: true,
    },


    // --------------------------------------------------
    // STATUS
    //
    // held:
    // User seat click pannirukkar.
    // Payment not completed.
    //
    // Other users UI = ORANGE
    //
    // booked:
    // PayHere payment verified.
    //
    // All users UI = RED
    // --------------------------------------------------

    status: {
      type: String,

      enum: [
        "held",
        "booked",
      ],

      default: "held",

      required: true,

      index: true,
    },


    // --------------------------------------------------
    // HOLD EXPIRY
    //
    // held:
    // temporary expiry time
    //
    // booked:
    // null
    //
    // IMPORTANT:
    // Initial seat-click hold can be shorter.
    // Example: 2 minutes while user is selecting.
    //
    // After passenger details:
    // extend to full 15 minutes for payment.
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
// PREVENT DOUBLE HOLD / DOUBLE BOOKING
// ======================================================
//
// Example:
//
// Bus A
// Date 2026-09-30
// Seat 18
//
// Only ONE SeatLock document allowed.
//
// Passenger 1 gets seat first:
// SeatLock inserted ✅
//
// Passenger 2 tries same seat:
// duplicate key error ❌
//
// This is what prevents race condition.
// ======================================================

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
// FIND LOCKS BY SELECTION
// ======================================================
//
// Used when:
// - user deselects seats
// - modal closes
// - passenger details submitted
// - attach temporary locks to booking
// ======================================================

seatLockSchema.index({
  selectionId: 1,
  status: 1,
});


// ======================================================
// FIND USER'S SELECTION
// ======================================================

seatLockSchema.index({
  userId: 1,
  selectionId: 1,
});


// ======================================================
// FAST EXPIRED HOLD SEARCH
// ======================================================
//
// holdCleanup.js:
//
// {
//   status: "held",
//   expiresAt: { $lte: new Date() }
// }
//
// Expired seat:
//
// HELD → DELETE
// SSE → released
// UI → WHITE
// ======================================================

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