const express = require("express");

const Booking = require("../models/Booking");
const Bus = require("../models/Bus");
const SeatLock = require("../models/SeatLock");

const {
  getNextSequence,
} = require("../models/Counter");

const generateTicketPdf =
  require("../utils/generateTicketPdf");

const {
  COUNTER_SEATS,
} = require("../config/seatLayout");

const {
  protect,
} = require("../middleware/auth");

const {
  broadcastSeatUpdate,
} = require("../utils/realtimeSeats");


const router = express.Router();


// ======================================================
// SETTINGS
// ======================================================

const HOLD_MINUTES = 15;

const HOLD_DURATION_MS =
  HOLD_MINUTES * 60 * 1000;


// ======================================================
// TEST
// GET /api/bookings/test
// ======================================================

router.get("/test", (req, res) => {
  res.json({
    message: "Booking route working",
  });
});


// ======================================================
// HELPER
// RELEASE EXPIRED HOLDS FOR REQUESTED SEATS
// ======================================================

async function releaseExpiredSeatLocks(
  busId,
  journeyDate,
  seats
) {
  const now = new Date();

  const expiredLocks =
    await SeatLock.find({
      busId,
      journeyDate,

      seat: {
        $in: seats,
      },

      status: "held",

      expiresAt: {
        $lte: now,
      },
    });


  if (expiredLocks.length === 0) {
    return;
  }


  const bookingIds = [
    ...new Set(
      expiredLocks.map(
        (lock) =>
          String(lock.bookingId)
      )
    ),
  ];


  // Mark old pending bookings as expired
  await Booking.updateMany(
    {
      _id: {
        $in: bookingIds,
      },

      status: "Pending",
    },

    {
      $set: {
        status: "Expired",
      },
    }
  );


  // Delete expired seat holds
  await SeatLock.deleteMany({
    _id: {
      $in: expiredLocks.map(
        (lock) => lock._id
      ),
    },
  });


  // Tell all connected users
  broadcastSeatUpdate({
    busId,
    journeyDate,

    seats:
      expiredLocks.map(
        (lock) =>
          String(lock.seat)
      ),

    action: "released",

    status: "Expired",
  });
}


// ======================================================
// CREATE TEMPORARY BOOKING HOLD
// POST /api/bookings/create
//
// Passenger details submit panna:
// GREEN selected seat
//       ↓
// ORANGE held seat
//
// Hold = 15 minutes
// ======================================================

router.post(
  "/create",
  protect,
  async (req, res) => {

    let booking = null;

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

      if (
        !userId ||
        !busId ||
        !journeyDate
      ) {
        return res.status(400).json({
          success: false,

          message:
            "userId, busId and journeyDate are required",
        });
      }


      if (
        String(req.user.id) !==
        String(userId)
      ) {
        return res.status(403).json({
          success: false,

          message:
            "You can only create a booking for your own account",
        });
      }


      if (
        !Array.isArray(seats) ||
        seats.length === 0
      ) {
        return res.status(400).json({
          success: false,

          message:
            "At least one seat must be selected",
        });
      }


      if (
        !passengerName ||
        !mobileNo ||
        !email
      ) {
        return res.status(400).json({
          success: false,

          message:
            "Passenger name, mobile number and email are required",
        });
      }


      // --------------------------------------------------
      // NORMALIZE SEATS
      // --------------------------------------------------

      const normalizedSeats = [
        ...new Set(
          seats.map(
            (seat) =>
              String(seat).trim()
          )
        ),
      ];


      // --------------------------------------------------
      // FIND BUS
      // --------------------------------------------------

      const bus =
        await Bus.findById(busId);


      if (!bus) {
        return res.status(404).json({
          success: false,

          message:
            "Selected bus was not found",
        });
      }


      // --------------------------------------------------
      // COUNTER SEAT CHECK
      // --------------------------------------------------

      const counterSeatStrings =
        COUNTER_SEATS.map(String);


      const invalidSeats =
        normalizedSeats.filter(
          (seat) =>
            counterSeatStrings.includes(
              String(seat)
            )
        );


      if (
        invalidSeats.length > 0
      ) {
        return res.status(400).json({
          success: false,

          message:
            `Seats ${invalidSeats.join(
              ", "
            )} are counter seats and cannot be booked online`,
        });
      }


      // --------------------------------------------------
      // REMOVE ANY OLD EXPIRED HOLDS
      // --------------------------------------------------

      await releaseExpiredSeatLocks(
        bus._id,
        journeyDate,
        normalizedSeats
      );


      // --------------------------------------------------
      // HOLD EXPIRY
      // --------------------------------------------------

      const holdExpiresAt =
        new Date(
          Date.now() +
            HOLD_DURATION_MS
        );


      // --------------------------------------------------
      // GENERATE TICKET ID
      // --------------------------------------------------

      const seqNumber =
        await getNextSequence(
          "bookingTicket"
        );


      const ticketId =
        "RB" +
        String(seqNumber)
          .padStart(6, "0");


      // --------------------------------------------------
      // CREATE PENDING BOOKING
      // --------------------------------------------------

      booking =
        await Booking.create({
          ticketId,

          userId,

          busId:
            bus._id,

          busNo:
            bus.busNo,

          from:
            bus.from,

          to:
            bus.to,

          departTime:
            bus.depart,

          arriveTime:
            bus.arrive,

          journeyDate,

          passengerName:
            passengerName.trim(),

          mobileNo:
            mobileNo.trim(),

          nicNo:
            nicNo
              ? nicNo.trim()
              : "",

          email:
            email
              .trim()
              .toLowerCase(),

          seats:
            normalizedSeats,

          selectedSeats:
            normalizedSeats.join(
              ","
            ),

          boardingPoint:
            boardingPoint ||
            bus.from,

          droppingPoint:
            droppingPoint ||
            bus.to,

          totalFare:

            Number(totalFare),

          status:
            "Pending",

          holdExpiresAt,

          paidAt:
            null,
        });


      // --------------------------------------------------
      // CREATE SEAT HOLDS
      // --------------------------------------------------

      const lockDocs =
        normalizedSeats.map(
          (seat) => ({
            busId:
              bus._id,

            journeyDate,

            seat,

            bookingId:
              booking._id,

            userId:
              req.user.id,

            status:
              "held",

            expiresAt:
              holdExpiresAt,
          })
        );


      try {
        await SeatLock.collection
          .insertMany(
            lockDocs,
            {
              ordered: false,
            }
          );

      } catch (bulkError) {

        // Remove any locks created for
        // this booking
        await SeatLock.deleteMany({
          bookingId:
            booking._id,
        });


        // Delete pending booking
        await Booking.findByIdAndDelete(
          booking._id
        );


        const failedIndexes =
          new Set(
            (
              bulkError.writeErrors ||
              []
            ).map(
              (error) =>
                error.index
            )
          );


        let conflicts =
          normalizedSeats.filter(
            (_, index) =>
              failedIndexes.has(
                index
              )
          );


        // Fallback if driver didn't provide indexes
        if (
          conflicts.length === 0
        ) {
          const existingLocks =
            await SeatLock.find({
              busId:
                bus._id,

              journeyDate,

              seat: {
                $in:
                  normalizedSeats,
              },
            }).select(
              "seat"
            );


          conflicts =
            existingLocks.map(
              (lock) =>
                String(
                  lock.seat
                )
            );
        }


        return res.status(409).json({
          success: false,

          message:
            `Seats ${conflicts.join(
              ", "
            )} are currently held or already booked. Please select different seats.`,

          conflicts,
        });
      }


      // --------------------------------------------------
      // REAL-TIME:
      // PASSENGER DETAILS COMPLETE
      //
      // ORANGE
      // --------------------------------------------------

      broadcastSeatUpdate({
        busId:
          bus._id,

        journeyDate,

        seats:
          normalizedSeats,

        action:
          "held",

        bookingId:
          booking._id,

        status:
          "Pending",

        expiresAt:
          holdExpiresAt,
      });


      // --------------------------------------------------
      // SUCCESS
      // --------------------------------------------------

      return res
        .status(201)
        .json({
          success: true,

          message:
            `Seats held for ${HOLD_MINUTES} minutes. Complete payment to confirm your booking.`,

          booking,
        });

    } catch (error) {

      console.error(
        "Booking create error:",
        error
      );


      // Roll back only this booking
      if (booking?._id) {

        await SeatLock.deleteMany({
          bookingId:
            booking._id,
        }).catch(() => {});


        await Booking
          .findByIdAndDelete(
            booking._id
          )
          .catch(() => {});
      }


      return res.status(500).json({
        success: false,

        message:
          "Booking failed",

        error:
          error.message,
      });
    }
  }
);


// ======================================================
// USER BOOKING HISTORY
// GET /api/bookings/user/:userId
// ======================================================

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


// ======================================================
// PAY / CONFIRM BOOKING
// PUT /api/bookings/pay/:id
//
// ORANGE held
//       ↓ payment success
// RED booked
// ======================================================

router.put(
  "/pay/:id",
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


      // --------------------------------------------------
      // OWNERSHIP CHECK
      // --------------------------------------------------

      if (
        String(booking.userId) !==
        String(req.user.id)
      ) {
        return res.status(403).json({
          success: false,

          message:
            "You can only pay for your own booking",
        });
      }


      // --------------------------------------------------
      // ALREADY PAID
      // --------------------------------------------------

      if (
        booking.status ===
        "Paid"
      ) {
        return res.json({
          success: true,

          message:
            "Booking is already paid",

          booking,
        });
      }


      // --------------------------------------------------
      // INVALID STATUS
      // --------------------------------------------------

      if (
        booking.status ===
          "Cancelled" ||
        booking.status ===
          "Expired"
      ) {
        return res.status(400).json({
          success: false,

          expired:
            booking.status ===
            "Expired",

          message:
            booking.status ===
            "Expired"
              ? "Your seat hold has expired. Please select the seats again."
              : "This booking has been cancelled.",
        });
      }


      // --------------------------------------------------
      // CHECK 15-MINUTE EXPIRY
      // --------------------------------------------------

      if (
        !booking.holdExpiresAt ||
        new Date(
          booking.holdExpiresAt
        ).getTime() <=
          Date.now()
      ) {

        // Release seat locks
        await SeatLock.deleteMany({
          bookingId:
            booking._id,

          status:
            "held",
        });


        booking.status =
          "Expired";


        await booking.save();


        // Real-time:
        // Orange → available
        broadcastSeatUpdate({
          busId:
            booking.busId,

          journeyDate:
            booking.journeyDate,

          seats:
            booking.seats ||
            [],

          action:
            "released",

          bookingId:
            booking._id,

          status:
            "Expired",
        });


        return res.status(410).json({
          success: false,

          expired: true,

          message:
            "Your 15-minute seat hold has expired. Please select the seats again.",
        });
      }


      // --------------------------------------------------
      // VERIFY SEAT HOLDS STILL EXIST
      // --------------------------------------------------

      const locks =
        await SeatLock.find({
          bookingId:
            booking._id,

          status:
            "held",
        });


      if (
        locks.length !==
        booking.seats.length
      ) {

        await SeatLock.deleteMany({
          bookingId:
            booking._id,
        });


        booking.status =
          "Expired";


        await booking.save();


        broadcastSeatUpdate({
          busId:
            booking.busId,

          journeyDate:
            booking.journeyDate,

          seats:
            booking.seats ||
            [],

          action:
            "released",

          bookingId:
            booking._id,

          status:
            "Expired",
        });


        return res.status(409).json({
          success: false,

          expired: true,

          message:
            "Your seat hold is no longer valid. Please select the seats again.",
        });
      }


      // --------------------------------------------------
      // PAYMENT SUCCESS
      //
      // SeatLock:
      // held → booked
      // expiry removed
      // --------------------------------------------------

      await SeatLock.updateMany(
        {
          bookingId:
            booking._id,
        },

        {
          $set: {
            status:
              "booked",

            expiresAt:
              null,
          },
        }
      );


      // --------------------------------------------------
      // BOOKING:
      // Pending → Paid
      // --------------------------------------------------

      booking.status =
        "Paid";

      booking.holdExpiresAt =
        null;

      booking.paidAt =
        new Date();


      await booking.save();


      // --------------------------------------------------
      // REAL-TIME:
      // ORANGE → RED
      // --------------------------------------------------

      broadcastSeatUpdate({
        busId:
          booking.busId,

        journeyDate:
          booking.journeyDate,

        seats:
          booking.seats ||
          [],

        action:
          "booked",

        bookingId:
          booking._id,

        status:
          "Paid",
      });


      return res.json({
        success: true,

        message:
          "Payment successful. Your seats are confirmed.",

        booking,
      });

    } catch (error) {

      console.error(
        "Payment error:",
        error
      );


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


// ======================================================
// CANCEL BOOKING
// PUT /api/bookings/cancel/:id
// ======================================================

router.put(
  "/cancel/:id",
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
            "You are not allowed to cancel this booking",
        });
      }


      if (
        booking.status ===
        "Cancelled"
      ) {
        return res.status(400).json({
          success: false,

          message:
            "This booking is already cancelled",
        });
      }


      if (
        booking.status ===
        "Expired"
      ) {
        return res.status(400).json({
          success: false,

          message:
            "This booking has already expired",
        });
      }


      // Release seats
      await SeatLock.deleteMany({
        bookingId:
          booking._id,
      });


      booking.status =
        "Cancelled";

      booking.holdExpiresAt =
        null;


      await booking.save();


      // Real-time:
      // Orange/Red → available
      broadcastSeatUpdate({
        busId:
          booking.busId,

        journeyDate:
          booking.journeyDate,

        seats:
          booking.seats ||
          [],

        action:
          "released",

        bookingId:
          booking._id,

        status:
          "Cancelled",
      });


      return res.json({
        success: true,

        message:
          "Booking cancelled",

        booking,
      });

    } catch (error) {

      console.error(
        "Cancellation error:",
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


// ======================================================
// SINGLE BOOKING
// GET /api/bookings/:id
// ======================================================

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


// ======================================================
// DOWNLOAD TICKET PDF
// GET /api/bookings/:id/pdf
// ======================================================

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


      // Ticket only after payment
      if (
        booking.status !==
        "Paid"
      ) {
        return res.status(400).json({
          success: false,

          message:
            "Ticket is available only after successful payment",
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


module.exports = router;