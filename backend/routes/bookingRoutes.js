const express = require("express");

const Booking = require("../models/Booking");
const Bus = require("../models/Bus");
const Trip = require("../models/Trip");
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


const router =
  express.Router();


// ======================================================
// SETTINGS
// ======================================================

const HOLD_MINUTES =
  15;

const HOLD_DURATION_MS =
  HOLD_MINUTES *
  60 *
  1000;


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
// RELEASE EXPIRED LOCKS
// ======================================================

async function releaseExpiredSeatLocks(
  tripId,
  seats
) {

  const now =
    new Date();


  const expiredLocks =
    await SeatLock.find({

      tripId,

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
  // BOOKING IDS
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
  // EXPIRE OLD PENDING BOOKINGS
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
  // GROUP BY BUS + DATE
  //
  // Existing SSE currently uses bus/date.
  // ====================================================

  const groups =
    new Map();


  expiredLocks.forEach(
    (lock) => {

      const key =
        `${lock.busId}|${lock.journeyDate}`;


      if (
        !groups.has(key)
      ) {

        groups.set(
          key,
          {
            busId:
              lock.busId,

            journeyDate:
              lock.journeyDate,

            seats:
              [],
          }
        );
      }


      groups
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
    of groups.values()
  ) {

    broadcastSeatUpdate({

      busId:
        group.busId,

      journeyDate:
        group.journeyDate,

      tripId,

      seats:
        group.seats,

      action:
        "released",

      status:
        "Expired",
    });
  }
}


// ======================================================
// CREATE BOOKING
//
// POST /api/bookings/create
// ======================================================

router.post(
  "/create",
  protect,

  async (req, res) => {

    let booking =
      null;


    try {

      const {

        tripId,

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


      // ==================================================
      // REQUIRED DATA
      // ==================================================

      if (
        !tripId ||
        !userId ||
        !busId ||
        !journeyDate
      ) {

        return res
          .status(400)
          .json({

            success:
              false,

            tripError:
              !tripId,

            message:
              "tripId, userId, busId and journeyDate are required",
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
              "No valid seats were selected",
          });
      }


      // ==================================================
      // FIND TRIP
      // ==================================================

      let trip;


      try {

        trip =
          await Trip.findById(
            tripId
          );


      } catch (error) {

        return res
          .status(400)
          .json({

            success:
              false,

            tripError:
              true,

            message:
              "Invalid trip ID",
          });
      }


      if (!trip) {

        return res
          .status(404)
          .json({

            success:
              false,

            tripError:
              true,

            message:
              "Selected trip was not found",
          });
      }


      // ==================================================
      // OPTIONAL STATUS CHECK
      //
      // If Trip has status field.
      // ==================================================

      if (
        trip.status &&
        String(
          trip.status
        ).toLowerCase() !==
          "active"
      ) {

        return res
          .status(409)
          .json({

            success:
              false,

            tripError:
              true,

            message:
              "This trip is currently unavailable for booking",
          });
      }


      // ==================================================
      // FIND PHYSICAL BUS
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

            tripError:
              true,

            message:
              "Selected bus was not found",
          });
      }


      // ==================================================
      // VERIFY TRIP BUS
      // ==================================================

      if (
        !trip.busId ||
        String(
          trip.busId
        ) !==
        String(
          bus._id
        )
      ) {

        return res
          .status(409)
          .json({

            success:
              false,

            tripError:
              true,

            message:
              "Selected trip does not belong to this bus",
          });
      }


      // ==================================================
      // VERIFY DATE
      // ==================================================

      if (
        trip.journeyDate &&
        String(
          trip.journeyDate
        ) !==
        String(
          journeyDate
        )
      ) {

        return res
          .status(409)
          .json({

            success:
              false,

            tripError:
              true,

            message:
              "Selected trip does not match the journey date",
          });
      }


      // ==================================================
      // COUNTER SEATS
      // ==================================================

      const counterSeatStrings =
        (COUNTER_SEATS || [])
          .map(
            String
          );


      const invalidSeats =
        normalizedSeats.filter(
          (seat) =>
            counterSeatStrings.includes(
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
      // RELEASE EXPIRED LOCKS FOR THIS TRIP
      // ==================================================

      await releaseExpiredSeatLocks(
        trip._id,
        normalizedSeats
      );


      // ==================================================
      // HOLD EXPIRY
      // ==================================================

      const holdExpiresAt =
        new Date(
          Date.now() +
          HOLD_DURATION_MS
        );


      // ==================================================
      // FARE
      //
      // Use trip fare when available.
      // ==================================================

      const tripFare =
        Number(
          trip.fare
        );


      let finalTotalFare =
        Number(
          totalFare
        );


      if (
        Number.isFinite(
          tripFare
        ) &&
        tripFare >= 0
      ) {

        finalTotalFare =
          tripFare *
          normalizedSeats.length;
      }


      if (
        !Number.isFinite(
          finalTotalFare
        ) ||
        finalTotalFare < 0
      ) {

        return res
          .status(400)
          .json({

            success:
              false,

            message:
              "Invalid booking fare",
          });
      }


      // ==================================================
      // GENERATE TICKET
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
      // TRIP SNAPSHOT
      // ==================================================

      const bookingFrom =
        trip.from ||
        bus.from;


      const bookingTo =
        trip.to ||
        bus.to;


      const bookingDepart =
        trip.depart ||
        bus.depart;


      const bookingArrive =
        trip.arrive ||
        bus.arrive;


      // ==================================================
      // CREATE PENDING BOOKING
      // ==================================================

      booking =
        await Booking.create({

          ticketId,


          // USER
          userId:
            req.user.id,


          // TRIP
          tripId:
            trip._id,


          // BUS
          busId:
            bus._id,

          busNo:
            bus.busNo,


          // JOURNEY
          from:
            bookingFrom,

          to:
            bookingTo,

          departTime:
            bookingDepart,

          arriveTime:
            bookingArrive,

          journeyDate,


          // PASSENGER
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


          // SEATS
          seats:
            normalizedSeats,

          selectedSeats:
            normalizedSeats
              .join(","),


          // BOARDING
          boardingPoint:
            boardingPoint ||
            bookingFrom,

          droppingPoint:
            droppingPoint ||
            bookingTo,


          // FARE
          totalFare:
            finalTotalFare,


          // STATUS
          status:
            "Pending",

          holdExpiresAt,

          paidAt:
            null,
        });


      // ==================================================
      // CREATE TRIP-BASED SEAT LOCKS
      // ==================================================

      const lockDocs =
        normalizedSeats.map(
          (seat) => ({

            // IMPORTANT
            tripId:
              trip._id,

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


      // ==================================================
      // ATOMIC INSERT
      //
      // unique:
      // tripId + seat
      // ==================================================

      try {

        await SeatLock.collection
          .insertMany(
            lockDocs,
            {
              ordered:
                false,
            }
          );


      } catch (bulkError) {

        // ================================================
        // DELETE ANY LOCK CREATED FOR THIS BOOKING
        // ================================================

        await SeatLock.deleteMany({

          bookingId:
            booking._id,
        });


        // ================================================
        // DELETE INCOMPLETE BOOKING
        // ================================================

        await Booking
          .findByIdAndDelete(
            booking._id
          );


        booking =
          null;


        // ================================================
        // FIND CONFLICTS
        // ================================================

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


        // ================================================
        // FALLBACK
        // ================================================

        if (
          conflicts.length ===
          0
        ) {

          const existingLocks =
            await SeatLock.find({

              tripId:
                trip._id,

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


        return res
          .status(409)
          .json({

            success:
              false,

            conflicts,

            message:
              `Seats ${conflicts.join(
                ", "
              )} are already held or booked for this trip. Please select different seats.`,
          });
      }


      // ==================================================
      // REAL-TIME HELD
      // ==================================================

      broadcastSeatUpdate({

        tripId:
          trip._id,

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
        });


    } catch (error) {

      console.error(
        "Booking create error:",
        error
      );


      // ==================================================
      // ROLLBACK
      // ==================================================

      if (
        booking?._id
      ) {

        await SeatLock.deleteMany({

          bookingId:
            booking._id,

        }).catch(
          () => {}
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
        "Booking history error:",
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
      // OWNER
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
      // HOLD EXPIRED
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

          tripId:
            booking.tripId,

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
      // VERIFY LOCKS
      // ==================================================

      const locks =
        await SeatLock.find({

          bookingId:
            booking._id,

          tripId:
            booking.tripId,

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

          tripId:
            booking.tripId,

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

          tripId:
            booking.tripId,
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
      // PENDING → PAID
      // ==================================================

      booking.status =
        "Paid";

      booking.holdExpiresAt =
        null;

      booking.paidAt =
        new Date();


      await booking.save();


      // ==================================================
      // REAL-TIME RED
      // ==================================================

      broadcastSeatUpdate({

        tripId:
          booking.tripId,

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
      // RELEASE LOCK
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


      broadcastSeatUpdate({

        tripId:
          booking.tripId,

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


module.exports =
  router;