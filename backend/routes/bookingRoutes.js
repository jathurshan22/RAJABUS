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

const TEMP_HOLD_DURATION_MS =
  2 * 60 * 1000;


// ======================================================
// TEST
//
// GET /api/bookings/test
// ======================================================

router.get(
  "/test",
  (req, res) => {

    res.json({
      message:
        "Booking route working",
    });
  }
);


// ======================================================
// HELPER
// RELEASE EXPIRED HOLDS FOR REQUESTED SEATS
//
// Supports:
// 1. click-time temporary holds
//    bookingId = null
//
// 2. payment holds
//    bookingId = Booking ID
// ======================================================

async function releaseExpiredSeatLocks(
  busId,
  journeyDate,
  seats
) {

  const now =
    new Date();


  const expiredLocks =
    await SeatLock.find({

      busId,

      journeyDate,

      seat: {
        $in:
          seats,
      },

      status:
        "held",

      expiresAt: {
        $lte:
          now,
      },
    });


  if (
    expiredLocks.length ===
    0
  ) {
    return;
  }


  // ====================================================
  // FIND ONLY REAL BOOKING IDs
  //
  // Click-time locks have bookingId = null
  // ====================================================

  const bookingIds = [
    ...new Set(

      expiredLocks

        .filter(
          (lock) =>
            lock.bookingId
        )

        .map(
          (lock) =>
            String(
              lock.bookingId
            )
        )
    ),
  ];


  // ====================================================
  // EXPIRE PENDING BOOKINGS
  // ====================================================

  if (
    bookingIds.length >
    0
  ) {

    await Booking.updateMany(
      {
        _id: {
          $in:
            bookingIds,
        },

        status:
          "Pending",
      },

      {
        $set: {
          status:
            "Expired",

          holdExpiresAt:
            null,
        },
      }
    );
  }


  // ====================================================
  // DELETE EXPIRED LOCKS
  // ====================================================

  await SeatLock.deleteMany({
    _id: {
      $in:
        expiredLocks.map(
          (lock) =>
            lock._id
        ),
    },
  });


  // ====================================================
  // GROUP RELEASE EVENTS
  //
  // selectionId important because own passenger
  // can identify his own expired temporary hold.
  // ====================================================

  const releaseGroups =
    new Map();


  expiredLocks.forEach(
    (lock) => {

      const selectionId =
        lock.selectionId
          ? String(
              lock.selectionId
            )
          : "";

      const bookingId =
        lock.bookingId
          ? String(
              lock.bookingId
            )
          : "";

      const key =
        `${selectionId}|${bookingId}`;


      if (
        !releaseGroups.has(
          key
        )
      ) {

        releaseGroups.set(
          key,
          {
            selectionId:
              selectionId ||
              null,

            bookingId:
              bookingId ||
              null,

            seats: [],
          }
        );
      }


      releaseGroups
        .get(key)
        .seats
        .push(
          String(
            lock.seat
          )
        );
    }
  );


  // ====================================================
  // REAL-TIME RELEASE
  // ====================================================

  for (
    const group
    of releaseGroups.values()
  ) {

    broadcastSeatUpdate({

      busId,

      journeyDate,

      seats:
        group.seats,

      action:
        "released",

      selectionId:
        group.selectionId,

      bookingId:
        group.bookingId,

      status:
        "Expired",
    });
  }
}


// ======================================================
// CREATE BOOKING
//
// POST /api/bookings/create
//
// NEW FLOW:
//
// User clicks seat
//      ↓
// seatHoldRoutes creates SeatLock immediately
//
// bookingId = null
// selectionId = browser session ID
// status = held
//
// Passenger details submit
//      ↓
// This route verifies those locks
//      ↓
// Creates Booking
//      ↓
// Attaches existing locks to Booking
//      ↓
// Extends expiry to 15 minutes
// ======================================================

router.post(
  "/create",
  protect,
  async (req, res) => {

    let booking =
      null;


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

        selectionId,

      } = req.body;


      // ==================================================
      // BASIC VALIDATION
      // ==================================================

      if (
        !userId ||
        !busId ||
        !journeyDate ||
        !selectionId
      ) {

        return res
          .status(400)
          .json({

            success:
              false,

            message:
              "userId, busId, journeyDate and selectionId are required",
          });
      }


      // ==================================================
      // USER OWNERSHIP
      // ==================================================

      if (
        String(
          req.user.id
        ) !==
        String(
          userId
        )
      ) {

        return res
          .status(403)
          .json({

            success:
              false,

            message:
              "You can only create a booking for your own account",
          });
      }


      // ==================================================
      // SEAT VALIDATION
      // ==================================================

      if (
        !Array.isArray(
          seats
        ) ||
        seats.length ===
          0
      ) {

        return res
          .status(400)
          .json({

            success:
              false,

            message:
              "At least one seat must be selected",
          });
      }


      // ==================================================
      // PASSENGER VALIDATION
      // ==================================================

      if (
        !passengerName ||
        !mobileNo ||
        !email
      ) {

        return res
          .status(400)
          .json({

            success:
              false,

            message:
              "Passenger name, mobile number and email are required",
          });
      }


      // ==================================================
      // NORMALIZE SEATS
      // ==================================================

      const normalizedSeats = [
        ...new Set(

          seats

            .map(
              (seat) =>
                String(
                  seat
                ).trim()
            )

            .filter(
              Boolean
            )
        ),
      ];


      if (
        normalizedSeats.length ===
        0
      ) {

        return res
          .status(400)
          .json({

            success:
              false,

            message:
              "No valid seats were provided",
          });
      }


      // ==================================================
      // NORMALIZE SELECTION ID
      // ==================================================

      const cleanSelectionId =
        String(
          selectionId
        ).trim();


      if (
        !cleanSelectionId
      ) {

        return res
          .status(400)
          .json({

            success:
              false,

            message:
              "Seat selection session is invalid",
          });
      }


      // ==================================================
      // FIND BUS
      // ==================================================

      const bus =
        await Bus.findById(
          busId
        );


      if (!bus) {

        return res
          .status(404)
          .json({

            success:
              false,

            message:
              "Selected bus was not found",
          });
      }


      // ==================================================
      // COUNTER SEAT CHECK
      // ==================================================

      const counterSeatStrings =
        (COUNTER_SEATS || [])
          .map(
            String
          );


      const invalidSeats =
        normalizedSeats.filter(
          (seat) =>
            counterSeatStrings
              .includes(
                String(
                  seat
                )
              )
        );


      if (
        invalidSeats.length >
        0
      ) {

        return res
          .status(400)
          .json({

            success:
              false,

            message:
              `Seats ${invalidSeats.join(
                ", "
              )} are counter seats and cannot be booked online`,
          });
      }


      // ==================================================
      // RELEASE EXPIRED OLD HOLDS
      // ==================================================

      await releaseExpiredSeatLocks(
        bus._id,
        journeyDate,
        normalizedSeats
      );


      // ==================================================
      // VERIFY CLICK-TIME TEMPORARY LOCKS
      //
      // Must belong to:
      // same user
      // same selectionId
      // same bus
      // same date
      // selected seats
      // ==================================================

      const temporaryLocks =
        await SeatLock.find({

          busId:
            bus._id,

          journeyDate,

          seat: {
            $in:
              normalizedSeats,
          },

          userId:
            req.user.id,

          selectionId:
            cleanSelectionId,

          status:
            "held",

          bookingId:
            null,

          expiresAt: {
            $gt:
              new Date(),
          },
        });


      // ==================================================
      // CHECK WHICH SEATS STILL BELONG TO USER
      // ==================================================

      const lockedSeatSet =
        new Set(

          temporaryLocks.map(
            (lock) =>
              String(
                lock.seat
              )
          )
        );


      const missingSeats =
        normalizedSeats.filter(
          (seat) =>
            !lockedSeatSet.has(
              String(
                seat
              )
            )
        );


      if (
        missingSeats.length >
        0
      ) {

        return res
          .status(409)
          .json({

            success:
              false,

            expired:
              true,

            conflicts:
              missingSeats,

            message:
              `Seats ${missingSeats.join(
                ", "
              )} are no longer held by you. Please go back and select the seats again.`,
          });
      }


      // Extra safety
      if (
        temporaryLocks.length !==
        normalizedSeats.length
      ) {

        return res
          .status(409)
          .json({

            success:
              false,

            expired:
              true,

            message:
              "One or more selected seats are no longer available. Please select the seats again.",
          });
      }


      // ==================================================
      // CREATE FULL 15 MINUTE PAYMENT HOLD
      // ==================================================

      const holdExpiresAt =
        new Date(
          Date.now() +
          HOLD_DURATION_MS
        );


      // ==================================================
      // GENERATE TICKET ID
      // ==================================================

      const seqNumber =
        await getNextSequence(
          "bookingTicket"
        );


      const ticketId =
        "RB" +
        String(
          seqNumber
        ).padStart(
          6,
          "0"
        );


      // ==================================================
      // CREATE PENDING BOOKING
      // ==================================================

      booking =
        await Booking.create({

          ticketId,

          userId:
            req.user.id,

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
            String(
              passengerName
            ).trim(),

          mobileNo:
            String(
              mobileNo
            ).trim(),

          nicNo:
            nicNo
              ? String(
                  nicNo
                ).trim()
              : "",

          email:
            String(
              email
            )
              .trim()
              .toLowerCase(),

          seats:
            normalizedSeats,

          selectedSeats:
            normalizedSeats
              .join(","),

          boardingPoint:
            boardingPoint ||
            bus.from,

          droppingPoint:
            droppingPoint ||
            bus.to,

          totalFare:
            Number(
              totalFare
            ),

          status:
            "Pending",

          holdExpiresAt,

          paidAt:
            null,
        });


      // ==================================================
      // ATTACH EXISTING TEMP LOCKS TO BOOKING
      //
      // IMPORTANT:
      // No new SeatLock insertion here.
      // ==================================================

      const lockIds =
        temporaryLocks.map(
          (lock) =>
            lock._id
        );


      const attachResult =
        await SeatLock.updateMany(

          {
            _id: {
              $in:
                lockIds,
            },

            busId:
              bus._id,

            journeyDate,

            userId:
              req.user.id,

            selectionId:
              cleanSelectionId,

            status:
              "held",

            bookingId:
              null,

            expiresAt: {
              $gt:
                new Date(),
            },
          },

          {
            $set: {

              bookingId:
                booking._id,

              expiresAt:
                holdExpiresAt,
            },
          }
        );


      // ==================================================
      // ATTACH FAILED
      //
      // Example:
      // hold expired exactly while user submitted form.
      // ==================================================

      if (
        attachResult.modifiedCount !==
        normalizedSeats.length
      ) {

        // Return any successfully attached locks
        // to temporary selection state.

        await SeatLock.updateMany(

          {
            bookingId:
              booking._id,

            status:
              "held",
          },

          {
            $set: {

              bookingId:
                null,

              expiresAt:
                new Date(
                  Date.now() +
                  TEMP_HOLD_DURATION_MS
                ),
            },
          }
        );


        await Booking
          .findByIdAndDelete(
            booking._id
          );


        booking =
          null;


        return res
          .status(409)
          .json({

            success:
              false,

            expired:
              true,

            message:
              "Your temporary seat hold changed while submitting. Please go back and select the seats again.",
          });
      }


      // ==================================================
      // REAL-TIME UPDATE
      //
      // Other passengers already see ORANGE.
      //
      // This event updates:
      // bookingId + longer expiry information.
      // ==================================================

      broadcastSeatUpdate({

        busId:
          bus._id,

        journeyDate,

        seats:
          normalizedSeats,

        action:
          "held",

        selectionId:
          cleanSelectionId,

        bookingId:
          booking._id,

        userId:
          req.user.id,

        status:
          "Pending",

        expiresAt:
          holdExpiresAt,
      });


      // ==================================================
      // SUCCESS
      // ==================================================

      return res
        .status(201)
        .json({

          success:
            true,

          message:
            `Seats held for ${HOLD_MINUTES} minutes. Complete payment to confirm your booking.`,

          booking,

          holdExpiresAt,

          selectionId:
            cleanSelectionId,
        });


    } catch (error) {

      console.error(
        "Booking create error:",
        error
      );


      // ==================================================
      // SAFE ROLLBACK
      //
      // Booking creation succeeded but later step failed:
      //
      // bookingId → null
      // return temporary hold for 2 mins
      // ==================================================

      if (
        booking?._id
      ) {

        await SeatLock.updateMany(

          {
            bookingId:
              booking._id,

            status:
              "held",
          },

          {
            $set: {

              bookingId:
                null,

              expiresAt:
                new Date(
                  Date.now() +
                  TEMP_HOLD_DURATION_MS
                ),
            },
          }
        ).catch(
          (rollbackError) => {

            console.error(
              "Seat lock rollback failed:",
              rollbackError
            );
          }
        );


        await Booking
          .findByIdAndDelete(
            booking._id
          )
          .catch(
            () => {}
          );
      }


      return res
        .status(500)
        .json({

          success:
            false,

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
//
// GET /api/bookings/user/:userId
// ======================================================

router.get(
  "/user/:userId",
  protect,
  async (req, res) => {

    try {

      if (
        String(
          req.user.id
        ) !==
        String(
          req.params.userId
        )
      ) {

        return res
          .status(403)
          .json({

            success:
              false,

            message:
              "You can only view your own bookings",
          });
      }


      const bookings =
        await Booking.find({

          userId:
            req.params.userId,

        }).sort({

          createdAt:
            -1,
        });


      return res.json({

        success:
          true,

        bookings,
      });


    } catch (error) {

      console.error(
        "Get bookings error:",
        error
      );


      return res
        .status(500)
        .json({

          success:
            false,

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
//
// PUT /api/bookings/pay/:id
//
// ORANGE
//    ↓
// RED
//
// NOTE:
// PayHere verified notify route is still the proper
// payment authority in your main payment flow.
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

        return res
          .status(404)
          .json({

            success:
              false,

            message:
              "Booking not found",
          });
      }


      // ==================================================
      // OWNER CHECK
      // ==================================================

      if (
        String(
          booking.userId
        ) !==
        String(
          req.user.id
        )
      ) {

        return res
          .status(403)
          .json({

            success:
              false,

            message:
              "You can only pay for your own booking",
          });
      }


      // ==================================================
      // ALREADY PAID
      // ==================================================

      if (
        booking.status ===
        "Paid"
      ) {

        return res.json({

          success:
            true,

          message:
            "Booking is already paid",

          booking,
        });
      }


      // ==================================================
      // INVALID STATUS
      // ==================================================

      if (
        booking.status ===
          "Cancelled" ||

        booking.status ===
          "Expired"
      ) {

        return res
          .status(400)
          .json({

            success:
              false,

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


      // ==================================================
      // CHECK 15 MINUTE EXPIRY
      // ==================================================

      if (
        !booking.holdExpiresAt ||

        new Date(
          booking.holdExpiresAt
        ).getTime() <=
          Date.now()
      ) {

        await SeatLock.deleteMany({

          bookingId:
            booking._id,

          status:
            "held",
        });


        booking.status =
          "Expired";

        booking.holdExpiresAt =
          null;


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


        return res
          .status(410)
          .json({

            success:
              false,

            expired:
              true,

            message:
              "Your 15-minute seat hold has expired. Please select the seats again.",
          });
      }


      // ==================================================
      // VERIFY HELD SEATS STILL EXIST
      // ==================================================

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

        booking.holdExpiresAt =
          null;


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


        return res
          .status(409)
          .json({

            success:
              false,

            expired:
              true,

            message:
              "Your seat hold is no longer valid. Please select the seats again.",
          });
      }


      // ==================================================
      // HELD → BOOKED
      // ==================================================

      await SeatLock.updateMany(

        {
          bookingId:
            booking._id,

          status:
            "held",
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


      // ==================================================
      // BOOKING → PAID
      // ==================================================

      booking.status =
        "Paid";

      booking.holdExpiresAt =
        null;

      booking.paidAt =
        new Date();


      await booking.save();


      // ==================================================
      // REAL-TIME
      //
      // ORANGE → RED
      // ==================================================

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

        success:
          true,

        message:
          "Payment successful. Your seats are confirmed.",

        booking,
      });


    } catch (error) {

      console.error(
        "Payment error:",
        error
      );


      return res
        .status(500)
        .json({

          success:
            false,

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
//
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

        return res
          .status(404)
          .json({

            success:
              false,

            message:
              "Booking not found",
          });
      }


      // ==================================================
      // OWNERSHIP
      // ==================================================

      if (
        String(
          booking.userId
        ) !==
        String(
          req.user.id
        )
      ) {

        return res
          .status(403)
          .json({

            success:
              false,

            message:
              "You are not allowed to cancel this booking",
          });
      }


      if (
        booking.status ===
        "Cancelled"
      ) {

        return res
          .status(400)
          .json({

            success:
              false,

            message:
              "This booking is already cancelled",
          });
      }


      if (
        booking.status ===
        "Expired"
      ) {

        return res
          .status(400)
          .json({

            success:
              false,

            message:
              "This booking has already expired",
          });
      }


      // ==================================================
      // RELEASE SEATS
      // ==================================================

      await SeatLock.deleteMany({

        bookingId:
          booking._id,
      });


      booking.status =
        "Cancelled";

      booking.holdExpiresAt =
        null;


      await booking.save();


      // ==================================================
      // REAL-TIME RELEASE
      // ==================================================

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

        success:
          true,

        message:
          "Booking cancelled",

        booking,
      });


    } catch (error) {

      console.error(
        "Cancellation error:",
        error
      );


      return res
        .status(500)
        .json({

          success:
            false,

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
//
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

        return res
          .status(404)
          .json({

            success:
              false,

            message:
              "Booking not found",
          });
      }


      if (
        String(
          booking.userId
        ) !==
        String(
          req.user.id
        )
      ) {

        return res
          .status(403)
          .json({

            success:
              false,

            message:
              "You can only view your own bookings",
          });
      }


      return res.json({

        success:
          true,

        booking,
      });


    } catch (error) {

      console.error(
        "Get booking error:",
        error
      );


      return res
        .status(500)
        .json({

          success:
            false,

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
//
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

        return res
          .status(404)
          .json({

            success:
              false,

            message:
              "Booking not found",
          });
      }


      if (
        String(
          booking.userId
        ) !==
        String(
          req.user.id
        )
      ) {

        return res
          .status(403)
          .json({

            success:
              false,

            message:
              "You can only download your own ticket",
          });
      }


      // Ticket only after payment
      if (
        booking.status !==
        "Paid"
      ) {

        return res
          .status(400)
          .json({

            success:
              false,

            message:
              "Ticket is available only after successful payment",
          });
      }


      await generateTicketPdf(
        booking,
        res
      );


    } catch (error) {

      console.error(
        "Ticket PDF error:",
        error
      );


      if (
        !res.headersSent
      ) {

        return res
          .status(500)
          .json({

            success:
              false,

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