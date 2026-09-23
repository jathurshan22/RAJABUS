const express = require("express");
const Booking = require("../models/Booking");
const Bus = require("../models/Bus");
const SeatLock = require("../models/SeatLock");
const { getNextSequence } = require("../models/Counter");
const generateTicketPdf = require("../utils/generateTicketPdf");
const { COUNTER_SEATS } = require("../config/seatLayout");
const { protect } = require("../middleware/auth");

// REAL-TIME UPDATE
const {
  broadcastSeatUpdate,
} = require("../utils/realtimeSeats");

const router = express.Router();


// --------------------------------------------------
// TEST ROUTE
// GET /api/bookings/test
// --------------------------------------------------
router.get("/test", (req, res) => {
  res.json({
    message: "Booking route working",
  });
});


// --------------------------------------------------
// CREATE BOOKING
// POST /api/bookings/create
// --------------------------------------------------
router.post("/create", protect, async (req, res) => {
  let insertedSeats = [];
  let booking = null;

  let currentBusId = null;
  let currentJourneyDate = null;

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


    // --------------------------------------------------
    // BASIC VALIDATION
    // --------------------------------------------------

    if (!userId || !busId || !journeyDate) {
      return res.status(400).json({
        success: false,
        message:
          "userId, busId and journeyDate are required",
      });
    }


    // User can only book for own account
    if (String(req.user.id) !== String(userId)) {
      return res.status(403).json({
        success: false,
        message:
          "You can only create a booking for your own account",
      });
    }


    // Seat validation
    if (!Array.isArray(seats) || seats.length === 0) {
      return res.status(400).json({
        success: false,
        message:
          "At least one seat must be selected",
      });
    }


    // Passenger validation
    if (!passengerName || !mobileNo || !email) {
      return res.status(400).json({
        success: false,
        message:
          "Passenger name, mobile number and email are required",
      });
    }


    // --------------------------------------------------
    // FIND BUS
    // --------------------------------------------------

    const bus = await Bus.findById(busId);

    if (!bus) {
      return res.status(404).json({
        success: false,
        message:
          "Selected bus was not found",
      });
    }


    currentBusId = bus._id;
    currentJourneyDate = journeyDate;


    // --------------------------------------------------
    // CHECK COUNTER SEATS
    // --------------------------------------------------

    const invalidSeats = seats.filter((seat) =>
      COUNTER_SEATS.map(String).includes(String(seat))
    );


    if (invalidSeats.length > 0) {
      return res.status(400).json({
        success: false,
        message:
          `Seats ${invalidSeats.join(
            ", "
          )} are counter seats and cannot be booked online`,
      });
    }


    // --------------------------------------------------
    // GENERATE TICKET ID
    // --------------------------------------------------

    const seqNumber =
      await getNextSequence("bookingTicket");

    const ticketId =
      "RB" +
      String(seqNumber).padStart(6, "0");


    // --------------------------------------------------
    // CREATE PENDING BOOKING
    // --------------------------------------------------

    booking = await Booking.create({
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

      selectedSeats:
        seats.join(","),

      boardingPoint:
        boardingPoint || bus.from,

      droppingPoint:
        droppingPoint || bus.to,

      totalFare,
    });


    // --------------------------------------------------
    // ATOMICALLY LOCK SEATS
    // --------------------------------------------------

    try {
      const docs = seats.map((seat) => ({
        busId: bus._id,

        journeyDate,

        seat,

        bookingId:
          booking._id,
      }));


      await SeatLock.collection.insertMany(
        docs,
        {
          ordered: false,
        }
      );


      // All seats successfully locked
      insertedSeats = [...seats];

    } catch (bulkError) {

      // --------------------------------------------------
      // SOME SEATS ALREADY BOOKED
      // --------------------------------------------------

      const failedIndexes = new Set(
        (bulkError.writeErrors || []).map(
          (error) => error.index
        )
      );


      insertedSeats = seats.filter(
        (_, index) =>
          !failedIndexes.has(index)
      );


      const conflicts = seats.filter(
        (_, index) =>
          failedIndexes.has(index)
      );


      // --------------------------------------------------
      // ROLLBACK SEATS THAT WERE INSERTED
      // --------------------------------------------------

      if (insertedSeats.length > 0) {
        await SeatLock.deleteMany({
          busId: bus._id,

          journeyDate,

          seat: {
            $in: insertedSeats,
          },

          bookingId:
            booking._id,
        });
      }


      // Delete pending booking
      await Booking.findByIdAndDelete(
        booking._id
      );


      return res.status(409).json({
        success: false,

        message:
          `Seats ${conflicts.join(
            ", "
          )} were just booked by someone else. Please pick different seats.`,

        conflicts,
      });
    }


    // --------------------------------------------------
    // REAL-TIME UPDATE
    // TELL OTHER USERS THESE SEATS ARE BOOKED
    // --------------------------------------------------

    broadcastSeatUpdate({
      busId:
        bus._id,

      journeyDate,

      seats,

      action:
        "booked",

      bookingId:
        booking._id,

      status:
        booking.status,
    });


    // --------------------------------------------------
    // SUCCESS RESPONSE
    // --------------------------------------------------

    return res.status(201).json({
      success: true,

      message:
        "Booking created successfully",

      booking,
    });

  } catch (error) {

    console.error(
      "Booking create error:",
      error
    );


    // --------------------------------------------------
    // SAFE ROLLBACK
    // --------------------------------------------------

    if (
      insertedSeats.length > 0 &&
      booking &&
      currentBusId &&
      currentJourneyDate
    ) {
      await SeatLock.deleteMany({
        busId:
          currentBusId,

        journeyDate:
          currentJourneyDate,

        seat: {
          $in: insertedSeats,
        },

        bookingId:
          booking._id,
      }).catch((rollbackError) => {
        console.error(
          "Seat rollback failed:",
          rollbackError
        );
      });
    }


    // Delete incomplete booking if needed
    if (booking?._id) {
      await Booking.findByIdAndDelete(
        booking._id
      ).catch(() => {});
    }


    return res.status(500).json({
      success: false,

      message:
        "Booking failed",

      error:
        error.message,
    });
  }
});


// --------------------------------------------------
// USER BOOKING HISTORY
// GET /api/bookings/user/:userId
// --------------------------------------------------

router.get(
  "/user/:userId",
  protect,
  async (req, res) => {

    try {

      if (
        String(req.user.id) !==
        String(req.params.userId)
      ) {

        return res.status(403).json({
          success: false,

          message:
            "You can only view your own bookings",
        });
      }


      const bookings =
        await Booking.find({
          userId:
            req.params.userId,
        }).sort({
          createdAt: -1,
        });


      return res.json({
        success: true,

        bookings,
      });

    } catch (error) {

      return res.status(500).json({
        success: false,

        message:
          "Failed to get bookings",

        error:
          error.message,
      });
    }
  }
);


// --------------------------------------------------
// SINGLE BOOKING
// GET /api/bookings/:id
// --------------------------------------------------

router.get(
  "/:id",
  protect,
  async (req, res) => {

    try {

      const booking =
        await Booking.findById(
          req.params.id
        );


      if (!booking) {

        return res.status(404).json({
          success: false,

          message:
            "Booking not found",
        });
      }


      if (
        String(booking.userId) !==
        String(req.user.id)
      ) {

        return res.status(403).json({
          success: false,

          message:
            "You can only view your own bookings",
        });
      }


      return res.json({
        success: true,

        booking,
      });

    } catch (error) {

      return res.status(500).json({
        success: false,

        message:
          "Failed to get booking",

        error:
          error.message,
      });
    }
  }
);


// --------------------------------------------------
// DOWNLOAD TICKET PDF
// GET /api/bookings/:id/pdf
// --------------------------------------------------

router.get(
  "/:id/pdf",
  protect,
  async (req, res) => {

    try {

      const booking =
        await Booking.findById(
          req.params.id
        );


      if (!booking) {

        return res.status(404).json({
          success: false,

          message:
            "Booking not found",
        });
      }


      if (
        String(booking.userId) !==
        String(req.user.id)
      ) {

        return res.status(403).json({
          success: false,

          message:
            "You can only download your own ticket",
        });
      }


      await generateTicketPdf(
        booking,
        res
      );

    } catch (error) {

      if (!res.headersSent) {

        return res.status(500).json({
          success: false,

          message:
            "Failed to generate ticket PDF",

          error:
            error.message,
        });
      }
    }
  }
);


// --------------------------------------------------
// MARK BOOKING AS PAID
// PUT /api/bookings/pay/:id
// --------------------------------------------------

router.put(
  "/pay/:id",
  protect,
  async (req, res) => {

    try {

      const existing =
        await Booking.findById(
          req.params.id
        );


      if (!existing) {

        return res.status(404).json({
          success: false,

          message:
            "Booking not found",
        });
      }


      if (
        String(existing.userId) !==
        String(req.user.id)
      ) {

        return res.status(403).json({
          success: false,

          message:
            "You can only pay for your own booking",
        });
      }


      const booking =
        await Booking.findByIdAndUpdate(
          req.params.id,

          {
            status: "Paid",
          },

          {
            new: true,
          }
        );


      return res.json({
        success: true,

        message:
          "Payment successful",

        booking,
      });

    } catch (error) {

      return res.status(500).json({
        success: false,

        message:
          "Payment failed",

        error:
          error.message,
      });
    }
  }
);


// --------------------------------------------------
// CANCEL BOOKING
// PUT /api/bookings/cancel/:id
// --------------------------------------------------

router.put(
  "/cancel/:id",
  protect,
  async (req, res) => {

    try {

      const existing =
        await Booking.findById(
          req.params.id
        );


      if (!existing) {

        return res.status(404).json({
          success: false,

          message:
            "Booking not found",
        });
      }


      if (
        String(existing.userId) !==
        String(req.user.id)
      ) {

        return res.status(403).json({
          success: false,

          message:
            "You are not allowed to cancel this booking",
        });
      }


      if (
        existing.status ===
        "Cancelled"
      ) {

        return res.status(400).json({
          success: false,

          message:
            "This booking is already cancelled",
        });
      }


      // --------------------------------------------------
      // UPDATE BOOKING STATUS
      // --------------------------------------------------

      const booking =
        await Booking.findByIdAndUpdate(
          req.params.id,

          {
            status:
              "Cancelled",
          },

          {
            new: true,
          }
        );


      // --------------------------------------------------
      // RELEASE SEAT LOCKS
      // --------------------------------------------------

      await SeatLock.deleteMany({
        bookingId:
          booking._id,
      });


      // --------------------------------------------------
      // REAL-TIME UPDATE
      // TELL OTHER USERS SEATS ARE AVAILABLE
      // --------------------------------------------------

      broadcastSeatUpdate({
        busId:
          booking.busId,

        journeyDate:
          booking.journeyDate,

        seats:
          booking.seats || [],

        action:
          "released",

        bookingId:
          booking._id,

        status:
          booking.status,
      });


      return res.json({
        success: true,

        message:
          "Booking cancelled",

        booking,
      });

    } catch (error) {

      console.error(
        "Booking cancellation error:",
        error
      );


      return res.status(500).json({
        success: false,

        message:
          "Cancellation failed",

        error:
          error.message,
      });
    }
  }
);


module.exports = router;