const express = require("express");
const Booking = require("../models/Booking");
const Bus = require("../models/Bus");
const SeatLock = require("../models/SeatLock");
const { getNextSequence } = require("../models/Counter");
const generateTicketPdf = require("../utils/generateTicketPdf");
const { COUNTER_SEATS } = require("../config/seatLayout");
const { protect } = require("../middleware/auth");

const router = express.Router();

router.get("/test", (req, res) => {
  res.json({ message: "Booking route working" });
});

// POST /api/bookings/create
// Requires a valid user JWT. Seats are reserved atomically via SeatLock's
// unique index, so two simultaneous requests for the same seat can never
// both succeed - whichever insert loses the race gets a duplicate-key
// error and the whole booking is rolled back.
router.post("/create", protect, async (req, res) => {
  let insertedSeats = [];

  try {
    const {
      userId,
      busId,
      journeyDate,
      passengerName,
      mobileNo,
      nicNo,
      email,
      seats,
      boardingPoint,
      droppingPoint,
      totalFare,
    } = req.body;

    if (!userId || !busId || !journeyDate) {
      return res.status(400).json({
        success: false,
        message: "userId, busId and journeyDate are required",
      });
    }

    if (String(req.user.id) !== String(userId)) {
      return res.status(403).json({
        success: false,
        message: "You can only create a booking for your own account",
      });
    }

    if (!Array.isArray(seats) || seats.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one seat must be selected",
      });
    }

    if (!passengerName || !mobileNo || !email) {
      return res.status(400).json({
        success: false,
        message: "Passenger name, mobile number and email are required",
      });
    }

    const bus = await Bus.findById(busId);
    if (!bus) {
      return res.status(404).json({
        success: false,
        message: "Selected bus was not found",
      });
    }

    const invalidSeats = seats.filter((s) => COUNTER_SEATS.includes(s));
    if (invalidSeats.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Seats ${invalidSeats.join(", ")} are counter seats and cannot be booked online`,
      });
    }

    // Create the booking first (in "Pending" state) so we have a bookingId
    // to attach to each seat lock.
    const seqNumber = await getNextSequence("bookingTicket");
    const ticketId = "RB" + String(seqNumber).padStart(6, "0");

    const booking = await Booking.create({
      ticketId,
      userId,
      busId: bus._id,
      busNo: bus.busNo,
      from: bus.from,
      to: bus.to,
      departTime: bus.depart,
      arriveTime: bus.arrive,
      journeyDate,
      passengerName,
      mobileNo,
      nicNo,
      email,
      seats,
      selectedSeats: seats.join(","),
      boardingPoint: boardingPoint || bus.from,
      droppingPoint: droppingPoint || bus.to,
      totalFare,
    });

    // Atomically claim every seat. unordered so a duplicate on one seat
    // doesn't stop MongoDB from telling us about the others too.
    try {
      const docs = seats.map((seat) => ({
        busId: bus._id,
        journeyDate,
        seat,
        bookingId: booking._id,
      }));

      const result = await SeatLock.collection.insertMany(docs, { ordered: false });
      insertedSeats = seats; // all succeeded
    } catch (bulkError) {
      // Some seats were already taken. Figure out which ones actually
      // got inserted so we can release just those, then roll everything back.
      const failedIndexes = new Set(
        (bulkError.writeErrors || []).map((e) => e.index)
      );
      insertedSeats = seats.filter((_, i) => !failedIndexes.has(i));
      const conflicts = seats.filter((_, i) => failedIndexes.has(i));

      // Roll back: release any seat locks that did succeed, delete the
      // pending booking, and report which seats were the problem.
      if (insertedSeats.length > 0) {
        await SeatLock.deleteMany({
          busId: bus._id,
          journeyDate,
          seat: { $in: insertedSeats },
          bookingId: booking._id,
        });
      }
      await Booking.findByIdAndDelete(booking._id);

      return res.status(409).json({
        success: false,
        message: `Seats ${conflicts.join(", ")} were just booked by someone else. Please pick different seats.`,
        conflicts,
      });
    }

    res.status(201).json({
      success: true,
      message: "Booking created successfully",
      booking,
    });
  } catch (error) {
    // Something else went wrong after seats may have been locked - release
    // them so they aren't stuck as permanently unavailable.
    if (insertedSeats.length > 0) {
      await SeatLock.deleteMany({ seat: { $in: insertedSeats } }).catch(() => {});
    }
    res.status(500).json({
      success: false,
      message: "Booking failed",
      error: error.message,
    });
  }
});

// GET /api/bookings/user/:userId -> booking history (own bookings only)
router.get("/user/:userId", protect, async (req, res) => {
  try {
    if (String(req.user.id) !== String(req.params.userId)) {
      return res.status(403).json({
        success: false,
        message: "You can only view your own bookings",
      });
    }

    const bookings = await Booking.find({
      userId: req.params.userId,
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      bookings,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to get bookings",
      error: error.message,
    });
  }
});

// GET /api/bookings/:id -> single booking (used by booking-details/payment
// pages if the page is reloaded). Owner only.
router.get("/:id", protect, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res
        .status(404)
        .json({ success: false, message: "Booking not found" });
    }

    if (String(booking.userId) !== String(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: "You can only view your own bookings",
      });
    }

    res.json({ success: true, booking });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to get booking",
      error: error.message,
    });
  }
});

// GET /api/bookings/:id/pdf -> download a PDF ticket (owner only)
router.get("/:id/pdf", protect, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res
        .status(404)
        .json({ success: false, message: "Booking not found" });
    }

    if (String(booking.userId) !== String(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: "You can only download your own ticket",
      });
    }

    await generateTicketPdf(booking, res);
  } catch (error) {
    // Headers may already be sent if the PDF stream started, so only
    // respond with JSON if nothing has gone out yet.
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: "Failed to generate ticket PDF",
        error: error.message,
      });
    }
  }
});

// PUT /api/bookings/pay/:id -> mark as paid (owner only)
router.put("/pay/:id", protect, async (req, res) => {
  try {
    const existing = await Booking.findById(req.params.id);

    if (!existing) {
      return res
        .status(404)
        .json({ success: false, message: "Booking not found" });
    }

    if (String(existing.userId) !== String(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: "You can only pay for your own booking",
      });
    }

    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { status: "Paid" },
      { new: true }
    );

    res.json({
      success: true,
      message: "Payment successful",
      booking,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Payment failed",
      error: error.message,
    });
  }
});

// PUT /api/bookings/cancel/:id -> cancel a booking, frees the seats
// Owner only - identity comes from the verified JWT, not the request body.
router.put("/cancel/:id", protect, async (req, res) => {
  try {
    const existing = await Booking.findById(req.params.id);

    if (!existing) {
      return res
        .status(404)
        .json({ success: false, message: "Booking not found" });
    }

    if (String(existing.userId) !== String(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to cancel this booking",
      });
    }

    if (existing.status === "Cancelled") {
      return res.status(400).json({
        success: false,
        message: "This booking is already cancelled",
      });
    }

    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { status: "Cancelled" },
      { new: true }
    );

    // Release the seat locks so someone else can book these seats.
    await SeatLock.deleteMany({ bookingId: booking._id });

    res.json({
      success: true,
      message: "Booking cancelled",
      booking,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Cancellation failed",
      error: error.message,
    });
  }
});

module.exports = router;
