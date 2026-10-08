const mongoose = require("mongoose");


const bookingSchema =
  new mongoose.Schema(
    {
      // ==================================================
      // TICKET ID
      // Example: RB000042
      // ==================================================

      ticketId: {
        type: String,

        unique: true,

        sparse: true,
      },


      // ==================================================
      // USER
      // ==================================================

      userId: {
        type: String,

        required: true,

        index: true,
      },


      // ==================================================
      // SCHEDULED TRIP
      //
      // Trip created by bus operator.
      //
      // Example:
      // Operator creates:
      // Mihintale -> Batticaloa
      // 2026-09-30
      // 06:30
      //
      // Booking stores that Trip._id here.
      //
      // Existing old bookings may not have tripId,
      // therefore default = null for compatibility.
      // New bookingRoutes.js will require tripId.
      // ==================================================

      tripId: {
        type:
          mongoose.Schema.Types.ObjectId,

        ref: "Trip",

        default: null,

        index: true,
      },


      // ==================================================
      // PHYSICAL BUS
      // ==================================================

      busId: {
        type:
          mongoose.Schema.Types.ObjectId,

        ref: "Bus",

        required: true,

        index: true,
      },


      busNo: {
        type: String,

        trim: true,
      },


      from: {
        type: String,

        trim: true,
      },


      to: {
        type: String,

        trim: true,
      },


      departTime: {
        type: String,

        trim: true,
      },


      arriveTime: {
        type: String,

        trim: true,
      },


      // ==================================================
      // JOURNEY DATE
      //
      // Format:
      // YYYY-MM-DD
      // ==================================================

      journeyDate: {
        type: String,

        required: true,

        index: true,
      },


      // ==================================================
      // PASSENGER DETAILS
      // ==================================================

      passengerName: {
        type: String,

        trim: true,
      },


      mobileNo: {
        type: String,

        trim: true,
      },


      nicNo: {
        type: String,

        trim: true,
      },


      email: {
        type: String,

        trim: true,

        lowercase: true,
      },


      // ==================================================
      // SEATS
      // ==================================================

      seats: {
        type: [String],

        default: [],
      },


      // Example:
      // "12,17"
      selectedSeats: {
        type: String,
      },


      // ==================================================
      // BOARDING / DROPPING
      // ==================================================

      boardingPoint: {
        type: String,

        trim: true,
      },


      droppingPoint: {
        type: String,

        trim: true,
      },


      // ==================================================
      // FARE
      // ==================================================

      totalFare: {
        type: Number,

        required: true,

        min: 0,
      },


      // ==================================================
      // BOOKING STATUS
      //
      // Pending:
      // Seats temporarily held.
      //
      // Paid:
      // Payment successful.
      //
      // Cancelled:
      // Booking cancelled.
      //
      // Expired:
      // 15-minute payment hold expired.
      // ==================================================

      status: {
        type: String,

        enum: [
          "Pending",
          "Paid",
          "Cancelled",
          "Expired",
        ],

        default:
          "Pending",

        index: true,
      },


      // ==================================================
      // HOLD EXPIRY
      // ==================================================

      holdExpiresAt: {
        type: Date,

        default: null,

        index: true,
      },


      // ==================================================
      // PAYMENT COMPLETION TIME
      // ==================================================

      paidAt: {
        type: Date,

        default: null,
      },
    },

    {
      timestamps: true,
    }
  );


// ======================================================
// INDEXES
// ======================================================


// ------------------------------------------------------
// TRIP BOOKINGS
//
// Find all bookings for one scheduled trip.
// ------------------------------------------------------

bookingSchema.index({
  tripId: 1,

  status: 1,

  createdAt: -1,
});


// ------------------------------------------------------
// TRIP + DATE
// ------------------------------------------------------

bookingSchema.index({
  tripId: 1,

  journeyDate: 1,

  status: 1,
});


// ------------------------------------------------------
// BUS + DATE
//
// Existing real-time seat flow uses this.
// ------------------------------------------------------

bookingSchema.index({
  busId: 1,

  journeyDate: 1,

  status: 1,
});


// ------------------------------------------------------
// USER BOOKING HISTORY
// ------------------------------------------------------

bookingSchema.index({
  userId: 1,

  createdAt: -1,
});


// ------------------------------------------------------
// EXPIRED PENDING BOOKINGS
// ------------------------------------------------------

bookingSchema.index({
  status: 1,

  holdExpiresAt: 1,
});


// ======================================================
// EXPORT
// ======================================================

module.exports =
  mongoose.model(
    "Booking",
    bookingSchema
  );