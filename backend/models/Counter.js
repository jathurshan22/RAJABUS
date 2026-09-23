const mongoose = require("mongoose");

// One document per counter name (e.g. "bookingTicket"). findOneAndUpdate
// with $inc is atomic in MongoDB, so concurrent bookings never get the
// same number even without a transaction.
const counterSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  value: { type: Number, default: 0 },
});

const Counter = mongoose.model("Counter", counterSchema);

const getNextSequence = async (name) => {
  const counter = await Counter.findOneAndUpdate(
    { name },
    { $inc: { value: 1 } },
    { new: true, upsert: true }
  );
  return counter.value;
};

module.exports = { Counter, getNextSequence };
