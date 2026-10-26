
const mongoose = require("mongoose");
const { TOTAL_SEATS } = require("../config/seatLayout");

const busSchema = new mongoose.Schema(
  {
    operatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Operator",
      default: null,
      index: true,
    },

    busNo: {
      type: String,
      required: true,
      trim: true,
    },

    regNo: {
      type: String,
      required: true,
      trim: true,
    },

    type: {
      type: String,
      enum: ["Private", "CTB"],
      required: true,
    },

    
totalSeats: {
  type: Number,
  default: TOTAL_SEATS,
  validate: {
    validator(value) {
      return Number.isInteger(value) && value > 0;
    },
    message: "Total seats must be a positive whole number",
  },
},


    // Legacy fields retained for existing buses.
    // New operator bus registration does not use these.
    from: { type: String, trim: true },
    to: { type: String, trim: true },
    depart: { type: String },
    arrive: { type: String },
    distanceKm: { type: Number },
    fareMin: { type: Number },
    fareMax: { type: Number },
    date: { type: String },
  },
  {
    timestamps: true,
  }
);

busSchema.index({ to: 1 });

module.exports = mongoose.model("Bus", busSchema);
