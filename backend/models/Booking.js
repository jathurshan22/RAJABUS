const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
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
    // BUS / TRIP DETAILS
    // ==================================================
    busId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bus",
      required: true,
    },

    busNo: {
      type: String,
    },

    from: {
      type: String,
    },

    to: {
      type: String,
    },

    departTime: {
      type: String,
    },

    arriveTime: {
      type: String,
    },

    // Format: YYYY-MM-DD
    journeyDate: {
      type: String,
      required: true,
    },


    // ==================================================
    // PASSENGER DETAILS
    // ==================================================
    passengerName: {
      type: String,
    },

    mobileNo: {
      type: String,
    },

    nicNo: {
      type: String,
    },

    email: {
      type: String,
    },


    // ==================================================
    // SEATS
    // ==================================================
    seats: {
      type: [String],
      default: [],
    },

    // Example: "12,17"
    selectedSeats: {
      type: String,
    },


    // ==================================================
    // BOARDING / DROPPING
    // ==================================================
    boardingPoint: {
      type: String,
    },

    droppingPoint: {
      type: String,
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
    // Passenger details submitted.
    // Seats temporarily HELD.
    // UI = ORANGE
    //
    // Paid:
    // Payment successful.
    // Seats permanently booked.
    // UI = RED
    //
    // Cancelled:
    // User cancelled booking.
    // Seats available again.
    //
    // Expired:
    // Payment not completed within 15 minutes.
    // Seats automatically released.
    // ==================================================
    status: {
      type: String,

      enum: [
        "Pending",
        "Paid",
        "Cancelled",
        "Expired",
      ],

      default: "Pending",

      index: true,
    },


    // ==================================================
    // HOLD EXPIRY TIME
    //
    // Passenger details submit:
    // now + 15 minutes
    //
    // Payment success:
    // null
    //
    // Example:
    // 10:00 PM created
    // expires at 10:15 PM
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

// Quickly find bookings for particular bus/date
bookingSchema.index({
  busId: 1,
  journeyDate: 1,
  status: 1,
});


// User booking history
bookingSchema.index({
  userId: 1,
  createdAt: -1,
});


// Helps 15-minute cleanup find expired pending bookings
bookingSchema.index({
  status: 1,
  holdExpiresAt: 1,
});


module.exports = mongoose.model(
  "Booking",
  bookingSchema
);