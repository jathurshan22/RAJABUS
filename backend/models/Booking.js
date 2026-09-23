const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
  {
    // Human-readable ticket number shown to passengers/admin (e.g. "RB000042"),
    // separate from MongoDB's internal _id. Assigned via an atomic counter
    // in bookingRoutes.js at creation time.
    ticketId: {
      type: String,
      unique: true,
      sparse: true, // allows older bookings without one to still exist
    },

    userId: {
      type: String,
      required: true,
    },

    // Trip info (copied from the Bus at booking time so history stays
    // accurate even if the bus schedule changes later)
    busId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bus",
    },
    busNo: String,
    from: String,
    to: String,
    departTime: String,
    arriveTime: String,
    journeyDate: String, // "YYYY-MM-DD"

    // Passenger info
    passengerName: String,
    mobileNo: String,
    nicNo: String,
    email: String,

    // Seats
    seats: [String], // e.g. ["12", "17"]
    selectedSeats: String, // comma joined, kept for easy display ("12,17")

    boardingPoint: String,
    droppingPoint: String,
    totalFare: Number,

    status: {
      type: String,
      enum: ["Pending", "Paid", "Cancelled"],
      default: "Pending",
    },
  },
  {
    timestamps: true,
  }
);

bookingSchema.index({ busId: 1, journeyDate: 1, status: 1 });
bookingSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("Booking", bookingSchema);
