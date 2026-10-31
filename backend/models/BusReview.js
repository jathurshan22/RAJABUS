const mongoose = require("mongoose");

const busReviewSchema = new mongoose.Schema(
  {
    // The booking used to submit this review.
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
      unique: true,
    },

    // The physical bus.
    busId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bus",
      required: true,
    },

    // The logged-in passenger.
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Bus details saved with the review.
    busNo: {
      type: String,
      trim: true,
      default: "",
    },

    busRegNo: {
      type: String,
      trim: true,
      default: "",
    },

    from: {
      type: String,
      trim: true,
      default: "",
    },

    to: {
      type: String,
      trim: true,
      default: "",
    },

    // Public review details.
    name: {
      type: String,
      trim: true,
      maxlength: 100,
      default: "Anonymous",
    },

    place: {
      type: String,
      trim: true,
      maxlength: 100,
      default: "",
    },

    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      validate: {
        validator: Number.isInteger,
        message: "Rating must be a whole number from 1 to 5",
      },
    },

    text: {
      type: String,
      required: true,
      trim: true,
      minlength: 4,
      maxlength: 600,
    },
  },
  {
    timestamps: true,
  }
);

// Reviews for a specific bus.
busReviewSchema.index({
  busId: 1,
  createdAt: -1,
  _id: -1,
});

// Latest reviews for the Home page.
busReviewSchema.index({
  createdAt: -1,
  _id: -1,
});

module.exports = mongoose.model(
  "BusReview",
  busReviewSchema
);