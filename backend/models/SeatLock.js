const mongoose = require("mongoose");

// ======================================================
// SEAT LOCK MODEL
//
// One document = one seat inside ONE scheduled trip.
//
// Double booking prevention:
//
// tripId + seat
//
// Example:
//
// Trip A + Seat 18 = allowed
// Trip A + Seat 18 again = NOT allowed
//
// Trip B + Seat 18 = allowed
//
// Even if Trip A and Trip B use the same bus.
// ======================================================

const seatLockSchema =
  new mongoose.Schema(
    {
      // ==================================================
      // SCHEDULED TRIP
      // ==================================================

      tripId: {
        type:
          mongoose.Schema.Types.ObjectId,

        ref:
          "Trip",

        required:
          true,

        index:
          true,
      },


      // ==================================================
      // PHYSICAL BUS
      // ==================================================

      busId: {
        type:
          mongoose.Schema.Types.ObjectId,

        ref:
          "Bus",

        required:
          true,

        index:
          true,
      },


      // ==================================================
      // JOURNEY DATE
      //
      // Example:
      // 2026-09-30
      // ==================================================

      journeyDate: {
        type:
          String,

        required:
          true,

        index:
          true,
      },


      // ==================================================
      // SEAT NUMBER
      //
      // Examples:
      // 18
      // A1
      // ==================================================

      seat: {
        type:
          String,

        required:
          true,

        trim:
          true,
      },


      // ==================================================
      // BOOKING
      // ==================================================

      bookingId: {
        type:
          mongoose.Schema.Types.ObjectId,

        ref:
          "Booking",

        required:
          true,

        index:
          true,
      },


      // ==================================================
      // USER
      // ==================================================

      userId: {
        type:
          mongoose.Schema.Types.ObjectId,

        ref:
          "User",

        required:
          true,

        index:
          true,
      },


      // ==================================================
      // STATUS
      //
      // held:
      // Payment pending
      // UI = ORANGE
      //
      // booked:
      // Payment successful
      // UI = RED
      // ==================================================

      status: {
        type:
          String,

        enum: [
          "held",
          "booked",
        ],

        default:
          "held",

        required:
          true,

        index:
          true,
      },


      // ==================================================
      // HOLD EXPIRY
      //
      // held:
      // now + 15 minutes
      //
      // booked:
      // null
      // ==================================================

      expiresAt: {
        type:
          Date,

        default:
          null,

        index:
          true,
      },
    },

    {
      timestamps:
        true,
    }
  );


// ======================================================
// PREVENT DOUBLE BOOKING
//
// Same trip + same seat
// can only have ONE lock.
// ======================================================

seatLockSchema.index(
  {
    tripId:
      1,

    seat:
      1,
  },

  {
    unique:
      true,
  }
);


// ======================================================
// FAST TRIP SEAT SEARCH
// ======================================================

seatLockSchema.index({
  tripId:
    1,

  status:
    1,
});


// ======================================================
// TRIP + DATE
// ======================================================

seatLockSchema.index({
  tripId:
    1,

  journeyDate:
    1,

  status:
    1,
});


// ======================================================
// BOOKING LOCK SEARCH
// ======================================================

seatLockSchema.index({
  bookingId:
    1,

  status:
    1,
});


// ======================================================
// EXPIRED HOLD SEARCH
// ======================================================

seatLockSchema.index({
  status:
    1,

  expiresAt:
    1,
});


// ======================================================
// MODEL
// ======================================================

module.exports =
  mongoose.model(
    "SeatLock",
    seatLockSchema
  );