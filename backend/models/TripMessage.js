const mongoose = require("mongoose");

const tripMessageSchema = new mongoose.Schema(
  {
    tripId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Trip",
      required: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    senderName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
  },
  {
    timestamps: true,
  }
);

// Each trip has its own message history.
tripMessageSchema.index({
  tripId: 1,
  createdAt: -1,
  _id: -1,
});

module.exports = mongoose.model(
  "TripMessage",
  tripMessageSchema
);