const express = require("express");
const mongoose = require("mongoose");
const rateLimit = require("express-rate-limit");

const Trip = require("../models/Trip");
const User = require("../models/User");
const TripMessage = require("../models/TripMessage");

const { protect } = require("../middleware/auth");

const router = express.Router();

// ======================================================
// TODAY'S DATE — SRI LANKA
// ======================================================

function todayInSriLanka() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const part = (type) =>
    parts.find((item) => item.type === type).value;

  return (
    part("year") + "-" +
    part("month") + "-" +
    part("day")
  );
}

// ======================================================
// CHECK WHETHER THIS TRIP CHAT IS AVAILABLE
// ======================================================

async function requireOpenTrip(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.tripId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid trip ID",
      });
    }

    const trip = await Trip.findById(req.params.tripId)
      .populate("busId", "_id");

    if (!trip || !trip.busId) {
      return res.status(404).json({
        success: false,
        message: "Trip not found",
      });
    }

    const departure = new Date(
      trip.journeyDate + "T" +
      trip.departureTime + "+05:30"
    ).getTime();

    let arrival = new Date(
      trip.journeyDate + "T" +
      trip.arrivalTime + "+05:30"
    ).getTime();

    // Example: departure 22:00, arrival 05:00 next day.
    

    if (
      trip.journeyDate !== todayInSriLanka() ||
      trip.status !== "Active" ||
      !Number.isFinite(departure) ||
      !Number.isFinite(arrival) ||
      arrival <= Date.now()
    ) {
      return res.status(409).json({
        success: false,
        message: "This trip chat is not currently available",
      });
    }

    next();

  } catch (error) {
    console.error(
      "Trip chat availability error:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message: "Unable to check trip availability",
    });
  }
}

// ======================================================
// ONLY PASSENGER ACCOUNTS CAN SEND MESSAGES
// ======================================================

function passengerOnly(req, res, next) {
  if (
    req.user?.role !== "user" ||
    !mongoose.isValidObjectId(req.user?.id)
  ) {
    return res.status(403).json({
      success: false,
      message: "Passenger login required",
    });
  }

  next();
}

// Limit repeated messages from the same account.
const messageLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,

  keyGenerator: (req) => String(req.user.id),

  message: {
    success: false,
    message: "Please wait a little before sending more messages",
  },
});

// ======================================================
// GET MESSAGES
//
// GET /api/trip-chat/:tripId/messages
//
// Optional:
// ?before=MESSAGE_ID — older messages
// ?after=MESSAGE_ID  — newer messages
// ======================================================

router.get(
  "/:tripId/messages",
  requireOpenTrip,
  async (req, res) => {
    try {
      res.set("Cache-Control", "no-store");

      const { before, after } = req.query;

      if (
        before !== undefined &&
        after !== undefined
      ) {
        return res.status(400).json({
          success: false,
          message: "Use either before or after, not both",
        });
      }

      const forward = after !== undefined;
      const cursor = forward ? after : before;

      const filter = {
        tripId: req.params.tripId,
      };

      if (cursor !== undefined) {
        if (
          typeof cursor !== "string" ||
          !mongoose.isValidObjectId(cursor)
        ) {
          return res.status(400).json({
            success: false,
            message: "Invalid message cursor",
          });
        }

        const anchor = await TripMessage.findOne({
          _id: cursor,
          tripId: req.params.tripId,
        })
          .select("_id createdAt")
          .lean();

        if (!anchor) {
          return res.status(400).json({
            success: false,
            message: "Message cursor not found in this trip",
          });
        }

        const comparison = forward ? "$gt" : "$lt";

        filter.$or = [
          {
            createdAt: {
              [comparison]: anchor.createdAt,
            },
          },
          {
            createdAt: anchor.createdAt,
            _id: {
              [comparison]: anchor._id,
            },
          },
        ];
      }

      const direction = forward ? 1 : -1;

      const rows = await TripMessage.find(filter)
        .select(
          "_id tripId userId senderName message createdAt"
        )
        .sort({
          createdAt: direction,
          _id: direction,
        })
        .limit(101)
        .lean();

      const hasMore = rows.length > 100;
      const messages = rows.slice(0, 100);

      // Return messages in conversation order.
      if (!forward) {
        messages.reverse();
      }

      const edge = forward
        ? messages[messages.length - 1]
        : messages[0];

      return res.json({
        success: true,
        tripId: req.params.tripId,
        count: messages.length,
        messages,
        hasMore,
        nextCursor:
          hasMore && edge
            ? String(edge._id)
            : null,
      });

    } catch (error) {
      console.error(
        "Load trip messages error:",
        error.message
      );

      return res.status(500).json({
        success: false,
        message: "Unable to load messages",
      });
    }
  }
);

// ======================================================
// SEND MESSAGE
//
// POST /api/trip-chat/:tripId/messages
// Body: { "message": "Hello everyone" }
// ======================================================

router.post(
  "/:tripId/messages",
  protect,
  passengerOnly,
  messageLimiter,
  requireOpenTrip,
  async (req, res) => {
    try {
      const text = req.body?.message;

      if (
        typeof text !== "string" ||
        !text.trim() ||
        text.trim().length > 1000
      ) {
        return res.status(400).json({
          success: false,
          message: "Message must contain 1 to 1000 characters",
        });
      }

      const user = await User.findById(req.user.id)
        .select("fullName isVerified");

      if (!user || !user.isVerified) {
        return res.status(401).json({
          success: false,
          message:
            "Please log in with a verified passenger account",
        });
      }

      // Get sender identity from the logged-in account.
      // Do not accept sender names or user IDs from the browser.
      const saved = await TripMessage.create({
        tripId: req.params.tripId,
        userId: user._id,

        senderName: String(user.fullName)
          .trim()
          .slice(0, 100),

        message: text.trim(),
      });

      return res.status(201).json({
        success: true,

        message: {
          _id: saved._id,
          tripId: saved.tripId,
          userId: saved.userId,
          senderName: saved.senderName,
          message: saved.message,
          createdAt: saved.createdAt,
        },
      });

    } catch (error) {
      console.error(
        "Send trip message error:",
        error.message
      );

      return res.status(500).json({
        success: false,
        message: "Unable to send message",
      });
    }
  }
);

module.exports = router;