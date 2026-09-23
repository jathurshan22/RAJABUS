const express = require("express");
const Review = require("../models/Review");

const router = express.Router();

router.get("/test", (req, res) => {
  res.json({ message: "Review route working" });
});

// GET /api/reviews -> all reviews + aggregate stats
router.get("/", async (req, res) => {
  try {
    const reviews = await Review.find().sort({ createdAt: -1 });

    const total = reviews.length;
    const buckets = [0, 0, 0, 0, 0]; // index 0 = 1 star ... index 4 = 5 star
    let sum = 0;

    reviews.forEach((r) => {
      sum += r.rating;
      buckets[r.rating - 1] += 1;
    });

    const stats = {
      total,
      average: total ? sum / total : 0,
      buckets, // [count1star, count2star, count3star, count4star, count5star]
    };

    res.json({ success: true, reviews, stats });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to load reviews",
      error: error.message,
    });
  }
});

// POST /api/reviews -> create a new review
router.post("/", async (req, res) => {
  try {
    const { name, place, rating, text } = req.body;
    const numericRating = Number(rating);

    if (!numericRating || numericRating < 1 || numericRating > 5) {
      return res.status(400).json({
        success: false,
        message: "Rating must be between 1 and 5",
      });
    }

    if (!text || text.trim().length < 4) {
      return res.status(400).json({
        success: false,
        message: "Review text must be at least 4 characters",
      });
    }

    const review = await Review.create({
      name: (name || "").trim() || "Anonymous",
      place: (place || "").trim(),
      rating: numericRating,
      text: text.trim(),
    });

    res.status(201).json({
      success: true,
      message: "Review added",
      review,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to add review",
      error: error.message,
    });
  }
});

module.exports = router;
