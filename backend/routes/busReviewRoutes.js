const express = require("express");
const mongoose = require("mongoose");

const Booking = require("../models/Booking");
const Bus = require("../models/Bus");
const User = require("../models/User");
const BusReview = require("../models/BusReview");

const { protect } = require("../middleware/auth");

const router = express.Router();

// Publicly visible review fields.
const PUBLIC_FIELDS = [
  "_id",
  "busId",
  "busNo",
  "busRegNo",
  "from",
  "to",
  "name",
  "place",
  "rating",
  "text",
  "createdAt",
];

function isId(value) {
  return (
    typeof value === "string" &&
    /^[a-f\d]{24}$/i.test(value)
  );
}

function publicReview(review) {
  return Object.fromEntries(
    PUBLIC_FIELDS.map((field) => [
      field,
      review[field],
    ])
  );
}

function serverError(res, label, error) {
  console.error(label, error);

  return res.status(500).json({
    success: false,
    message: "Unable to process bus reviews. Please try again.",
  });
}

// ======================================================
// CHECK PASSENGER + BOOKING OWNERSHIP + PAYMENT
// ======================================================

async function ownedPaidBooking(req, res, next) {
  try {
    if (
      req.user?.role !== "user" ||
      !isId(req.user?.id)
    ) {
      return res.status(403).json({
        success: false,
        message: "Passenger login required",
      });
    }

    if (!isId(req.params.bookingId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking ID",
      });
    }

    const [booking, user] = await Promise.all([
      Booking.findById(
        req.params.bookingId
      ).lean(),

      User.findById(req.user.id)
        .select("fullName isVerified")
        .lean(),
    ]);

    if (!user || !user.isVerified) {
      return res.status(401).json({
        success: false,
        message:
          "Please log in with a verified passenger account",
      });
    }

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    if (
      String(booking.userId) !==
      String(user._id)
    ) {
      return res.status(403).json({
        success: false,
        message: "You can only review your own booking",
      });
    }

    if (booking.status !== "Paid") {
      return res.status(403).json({
        success: false,
        message:
          "Reviews are available for Paid bookings only",
      });
    }

    req.reviewBooking = booking;
    req.reviewUser = user;

    return next();

  } catch (error) {
    return serverError(
      res,
      "Review booking check failed:",
      error
    );
  }
}

// ======================================================
// BUS DETAILS
// Prefer details saved with the booking.
// Older bookings can use the bus record.
// ======================================================

async function busDetails(booking) {
  const bus = await Bus.findById(booking.busId)
    .select("busNo regNo from to")
    .lean();

  return {
    busId: booking.busId,

    busNo:
      booking.busNo ||
      bus?.busNo ||
      "",

    busRegNo:
      booking.busRegNo ||
      bus?.regNo ||
      "",

    from:
      booking.from ||
      bus?.from ||
      "",

    to:
      booking.to ||
      bus?.to ||
      "",
  };
}

// ======================================================
// GET REVIEW FORM DETAILS
// GET /api/bus-reviews/booking/:bookingId
// Login required.
// ======================================================

router.get(
  "/booking/:bookingId",
  protect,
  ownedPaidBooking,
  async (req, res) => {
    try {
      res.set("Cache-Control", "no-store");

      const booking = req.reviewBooking;
      const details = await busDetails(booking);

      const review = await BusReview.findOne({
        bookingId: booking._id,
      })
        .select(PUBLIC_FIELDS.join(" "))
        .lean();

      return res.json({
        success: true,

        booking: {
          bookingId: booking._id,
          ticketId: booking.ticketId || "",
          journeyDate: booking.journeyDate,
          ...details,
        },

        review,
      });

    } catch (error) {
      return serverError(
        res,
        "Load review form failed:",
        error
      );
    }
  }
);

// ======================================================
// SUBMIT A BUS REVIEW
// POST /api/bus-reviews/booking/:bookingId
//
// Body:
// {
//   "name": "Thana",
//   "place": "Ampara",
//   "rating": 5,
//   "text": "Good bus service."
// }
// ======================================================

router.post(
  "/booking/:bookingId",
  protect,
  ownedPaidBooking,
  async (req, res) => {
    try {
      const {
        name,
        place,
        rating,
        text,
      } = req.body || {};

      if (
        !Number.isInteger(rating) ||
        rating < 1 ||
        rating > 5
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Select a whole-number rating from 1 to 5",
        });
      }

      if (
        typeof text !== "string" ||
        text.trim().length < 4 ||
        text.trim().length > 600
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Your review must contain 4 to 600 characters",
        });
      }

      if (
        (
          name !== undefined &&
          (
            typeof name !== "string" ||
            name.trim().length > 100
          )
        ) ||
        (
          place !== undefined &&
          (
            typeof place !== "string" ||
            place.trim().length > 100
          )
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Name and location must be text, up to 100 characters each",
        });
      }

      const booking = req.reviewBooking;
      const user = req.reviewUser;

      const details = await busDetails(booking);

      // Ensure the unique booking index is ready.
      await BusReview.init();

      const review = await BusReview.create({
        bookingId: booking._id,
        userId: user._id,

        ...details,

        name:
          String(user.fullName || "")
            .trim()
            .slice(0, 100) || "Passenger",

        place: "",

        rating,
        text: text.trim(),
      });

      return res.status(201).json({
        success: true,
        message: "Your bus review was added",
        review: publicReview(review),
      });

    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({
          success: false,
          message:
            "You have already reviewed this booking",
        });
      }

      return serverError(
        res,
        "Save bus review failed:",
        error
      );
    }
  }
);

// ======================================================
// PUBLIC REVIEWS + RATING SUMMARY
//
// All buses:
// GET /api/bus-reviews?page=1&limit=12
//
// One bus:
// GET /api/bus-reviews?busId=BUS_ID&page=1&limit=12
// ======================================================

router.get("/", async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");

    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 12);
    const skip = (page - 1) * limit;

    if (
      !Number.isSafeInteger(page) ||
      page < 1 ||
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > 50 ||
      !Number.isSafeInteger(skip)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Page must be positive; limit must be 1 to 50",
      });
    }

    const filter = {};

    if (req.query.busId !== undefined) {
      if (!isId(req.query.busId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid bus ID",
        });
      }

      filter.busId =
        new mongoose.Types.ObjectId(
          req.query.busId
        );
    }

    const [reviews, counts] = await Promise.all([
      BusReview.find(filter)
        .select(PUBLIC_FIELDS.join(" "))
        .sort({
          createdAt: -1,
          _id: -1,
        })
        .skip(skip)
        .limit(limit)
        .lean(),

      BusReview.aggregate([
        {
          $match: filter,
        },
        {
          $group: {
            _id: "$rating",
            count: {
              $sum: 1,
            },
          },
        },
      ]),
    ]);

    // Index 0 = 1 star, index 4 = 5 stars.
    const buckets = [0, 0, 0, 0, 0];

    for (const row of counts) {
      const rating = Number(row._id);

      if (
        Number.isInteger(rating) &&
        rating >= 1 &&
        rating <= 5
      ) {
        buckets[rating - 1] = row.count;
      }
    }

    const total = buckets.reduce(
      (sum, count) => sum + count,
      0
    );

    const sum = buckets.reduce(
      (result, count, index) =>
        result + count * (index + 1),
      0
    );

    return res.json({
      success: true,

      reviews,

      stats: {
        total,
        average: total ? sum / total : 0,
        buckets,
      },

      pagination: {
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total,
      },
    });

  } catch (error) {
    return serverError(
      res,
      "Load public bus reviews failed:",
      error
    );
  }
});

module.exports = router;