const mongoose = require("mongoose");

const busSchema = new mongoose.Schema(
  {
    from: {
      type: String,
      required: true,
      default: "Mihintale",
    },
    to: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ["Private", "CTB"],
      required: true,
    },
    busNo: {
      type: String,
      required: true,
    },
    regNo: {
      type: String,
      required: true,
    },
    depart: {
      type: String, // "HH:MM"
      required: true,
    },
    arrive: {
      type: String, // "HH:MM"
      required: true,
    },
    distanceKm: {
      type: Number,
      required: true,
    },
    fareMin: {
      type: Number,
      required: true,
    },
    fareMax: {
      type: Number,
      required: true,
    },
    date: {
      type: String, // "YYYY-MM-DD"
    },
    totalSeats: {
      type: Number,
      default: 40,
    },
  },
  { timestamps: true }
);

busSchema.index({ to: 1 });

module.exports = mongoose.model("Bus", busSchema);
