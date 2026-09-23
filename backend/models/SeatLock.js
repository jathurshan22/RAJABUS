const mongoose = require("mongoose");

// One document per (bus, date, seat). The unique index is what actually
// prevents the race condition: MongoDB enforces it at the storage layer,
// so even two requests arriving at the exact same millisecond can't both
// successfully insert a lock for the same seat.
const seatLockSchema = new mongoose.Schema(
  {
    busId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bus",
      required: true,
    },
    journeyDate: { type: String, required: true },
    seat: { type: String, required: true },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
    },
  },
  { timestamps: true }
);

seatLockSchema.index(
  { busId: 1, journeyDate: 1, seat: 1 },
  { unique: true }
);

module.exports = mongoose.model("SeatLock", seatLockSchema);
