const express = require("express");

const Bus = require("../models/Bus");
const SeatLock = require("../models/SeatLock");

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
// INITIAL CLICK HOLD TIME
// ======================================================
//
// Passenger seat select pannumbodhu
// booking create aagurathukku munnadi
// temporary hold.
//
// Passenger details submit pannina piragu
// booking flow-la 15 minutes extend pannuvom.
//
// Ippo initial hold = 2 minutes.
//
const CLICK_HOLD_MS =
  2 * 60 * 1000;


// ======================================================
// HELPER
// ======================================================

function normalizeSeat(value) {
  return String(value || "").trim();
}


// ======================================================
// HOLD ONE SEAT
//
// POST /api/seat-holds/hold
//
// Body:
// {
//   busId,
//   journeyDate,
//   seat,
//   selectionId
// }
// ======================================================

router.post(
  "/hold",
  protect,
  async (req, res) => {

    try {

      const {
        busId,
        journeyDate,
        seat,
        selectionId,
      } = req.body;


      // --------------------------------------------------
      // BASIC VALIDATION
      // --------------------------------------------------

      if (
        !busId ||
        !journeyDate ||
        !seat ||
        !selectionId
      ) {

        return res.status(400).json({
          success: false,

          message:
            "busId, journeyDate, seat and selectionId are required",
        });
      }


      const seatNumber =
        normalizeSeat(seat);


      // --------------------------------------------------
      // CHECK BUS
      // --------------------------------------------------

      const bus =
        await Bus.findById(
          busId
        );


      if (!bus) {

        return res.status(404).json({
          success: false,

          message:
            "Bus not found",
        });
      }


      // --------------------------------------------------
      // COUNTER SEAT CHECK
      // --------------------------------------------------

      const counterSeats =
        (COUNTER_SEATS || [])
          .map(String);


      if (
        counterSeats.includes(
          seatNumber
        )
      ) {

        return res.status(400).json({
          success: false,

          message:
            `Seat ${seatNumber} is a counter seat and cannot be selected online`,
        });
      }


      // --------------------------------------------------
      // DELETE EXPIRED OLD HOLD FOR THIS SEAT
      //
      // Sometimes cleanup interval may not have run yet.
      // --------------------------------------------------

      const now =
        new Date();


      const expiredLock =
        await SeatLock.findOne({

          busId:
            bus._id,

          journeyDate,

          seat:
            seatNumber,

          status:
            "held",

          expiresAt: {
            $lte: now,
          },
        });


      if (expiredLock) {

        await SeatLock.deleteOne({
          _id:
            expiredLock._id,
        });


        // Tell browsers old hold released
        broadcastSeatUpdate({

          busId:
            bus._id,

          journeyDate,

          seats: [
            seatNumber,
          ],

          action:
            "released",

          selectionId:
            expiredLock.selectionId,

          bookingId:
            expiredLock.bookingId || null,

          status:
            "released",
        });
      }


      // --------------------------------------------------
      // CHECK EXISTING LOCK
      // --------------------------------------------------

      const existing =
        await SeatLock.findOne({

          busId:
            bus._id,

          journeyDate,

          seat:
            seatNumber,
        });


      if (existing) {

        // ----------------------------------------------
        // SAME BROWSER / SAME SELECTION
        //
        // User clicked already selected seat again
        // or request repeated.
        //
        // Refresh expiry.
        // ----------------------------------------------

        if (
          existing.status ===
            "held" &&

          String(
            existing.userId
          ) ===
            String(
              req.user.id
            ) &&

          existing.selectionId ===
            selectionId
        ) {

          existing.expiresAt =
            new Date(
              Date.now() +
              CLICK_HOLD_MS
            );


          await existing.save();


          return res.json({
            success: true,

            message:
              `Seat ${seatNumber} is already held by you`,

            seat:
              seatNumber,

            selectionId,

            expiresAt:
              existing.expiresAt,

            alreadyHeld:
              true,
          });
        }


        // ----------------------------------------------
        // BOOKED
        // ----------------------------------------------

        if (
          existing.status ===
          "booked"
        ) {

          return res.status(409).json({
            success: false,

            message:
              `Seat ${seatNumber} is already booked`,

            seat:
              seatNumber,

            conflict:
              true,

            status:
              "booked",
          });
        }


        // ----------------------------------------------
        // HELD BY ANOTHER PASSENGER
        // ----------------------------------------------

        return res.status(409).json({
          success: false,

          message:
            `Seat ${seatNumber} is temporarily held by another passenger`,

          seat:
            seatNumber,

          conflict:
            true,

          status:
            "held",
        });
      }


      // --------------------------------------------------
      // CREATE NEW TEMPORARY HOLD
      // --------------------------------------------------

      const expiresAt =
        new Date(
          Date.now() +
          CLICK_HOLD_MS
        );


      let lock;


      try {

        lock =
          await SeatLock.create({

            busId:
              bus._id,

            journeyDate,

            seat:
              seatNumber,

            userId:
              req.user.id,

            selectionId,

            bookingId:
              null,

            status:
              "held",

            expiresAt,
          });

      } catch (error) {

        // ----------------------------------------------
        // DUPLICATE KEY
        //
        // Two passengers clicked same seat
        // almost exactly same time.
        //
        // Unique index:
        // busId + journeyDate + seat
        // decides winner.
        // ----------------------------------------------

        if (
          error &&
          error.code === 11000
        ) {

          return res.status(409).json({
            success: false,

            message:
              `Seat ${seatNumber} was just selected by another passenger`,

            seat:
              seatNumber,

            conflict:
              true,
          });
        }


        throw error;
      }


      // --------------------------------------------------
      // REAL-TIME BROADCAST
      //
      // Passenger 1:
      // same selectionId → GREEN
      //
      // Passenger 2:
      // different selectionId → ORANGE
      // --------------------------------------------------

      broadcastSeatUpdate({

        busId:
          bus._id,

        journeyDate,

        seats: [
          seatNumber,
        ],

        action:
          "held",

        selectionId,

        bookingId:
          null,

        userId:
          req.user.id,

        status:
          "held",

        expiresAt:
          lock.expiresAt,
      });


      // --------------------------------------------------
      // SUCCESS
      // --------------------------------------------------

      return res.status(201).json({

        success: true,

        message:
          `Seat ${seatNumber} held successfully`,

        seat:
          seatNumber,

        selectionId,

        expiresAt:
          lock.expiresAt,
      });


    } catch (error) {

      console.error(
        "Seat hold error:",
        error
      );


      return res.status(500).json({

        success: false,

        message:
          "Could not hold seat",

        error:
          error.message,
      });
    }
  }
);


// ======================================================
// RELEASE ONE SEAT
//
// POST /api/seat-holds/release
//
// Body:
// {
//   busId,
//   journeyDate,
//   seat,
//   selectionId
// }
// ======================================================

router.post(
  "/release",
  protect,
  async (req, res) => {

    try {

      const {
        busId,
        journeyDate,
        seat,
        selectionId,
      } = req.body;


      if (
        !busId ||
        !journeyDate ||
        !seat ||
        !selectionId
      ) {

        return res.status(400).json({
          success: false,

          message:
            "busId, journeyDate, seat and selectionId are required",
        });
      }


      const seatNumber =
        normalizeSeat(seat);


      // --------------------------------------------------
      // FIND ONLY USER'S OWN TEMPORARY HOLD
      // --------------------------------------------------

      const lock =
        await SeatLock.findOne({

          busId,

          journeyDate,

          seat:
            seatNumber,

          userId:
            req.user.id,

          selectionId,

          status:
            "held",

          // Once attached to a booking,
          // seat should not be released from seat modal.
          bookingId:
            null,
        });


      if (!lock) {

        return res.status(404).json({
          success: false,

          message:
            "Temporary seat hold was not found",
        });
      }


      await SeatLock.deleteOne({
        _id:
          lock._id,
      });


      // --------------------------------------------------
      // REAL-TIME RELEASE
      // --------------------------------------------------

      broadcastSeatUpdate({

        busId:
          lock.busId,

        journeyDate:
          lock.journeyDate,

        seats: [
          lock.seat,
        ],

        action:
          "released",

        selectionId:
          lock.selectionId,

        bookingId:
          null,

        userId:
          req.user.id,

        status:
          "released",
      });


      return res.json({

        success: true,

        message:
          `Seat ${seatNumber} released`,

        seat:
          seatNumber,
      });


    } catch (error) {

      console.error(
        "Seat release error:",
        error
      );


      return res.status(500).json({

        success: false,

        message:
          "Could not release seat",

        error:
          error.message,
      });
    }
  }
);


// ======================================================
// RELEASE ALL TEMPORARY SEATS FOR ONE SELECTION
//
// POST /api/seat-holds/release-all
//
// Use when:
// - user closes modal
// - user changes bus
// - user goes back
//
// Body:
// {
//   busId,
//   journeyDate,
//   selectionId
// }
// ======================================================

router.post(
  "/release-all",
  protect,
  async (req, res) => {

    try {

      const {
        busId,
        journeyDate,
        selectionId,
      } = req.body;


      if (
        !busId ||
        !journeyDate ||
        !selectionId
      ) {

        return res.status(400).json({
          success: false,

          message:
            "busId, journeyDate and selectionId are required",
        });
      }


      // --------------------------------------------------
      // ONLY PRE-BOOKING TEMPORARY HOLDS
      // --------------------------------------------------

      const locks =
        await SeatLock.find({

          busId,

          journeyDate,

          userId:
            req.user.id,

          selectionId,

          status:
            "held",

          bookingId:
            null,
        });


      if (
        locks.length === 0
      ) {

        return res.json({

          success: true,

          message:
            "No temporary seats to release",

          seats: [],
        });
      }


      const seats =
        locks.map(
          (lock) =>
            String(
              lock.seat
            )
        );


      await SeatLock.deleteMany({

        _id: {
          $in:
            locks.map(
              (lock) =>
                lock._id
            ),
        },
      });


      // --------------------------------------------------
      // REAL-TIME RELEASE
      // --------------------------------------------------

      broadcastSeatUpdate({

        busId,

        journeyDate,

        seats,

        action:
          "released",

        selectionId,

        bookingId:
          null,

        userId:
          req.user.id,

        status:
          "released",
      });


      return res.json({

        success: true,

        message:
          "Temporary seat holds released",

        seats,
      });


    } catch (error) {

      console.error(
        "Release all seat holds error:",
        error
      );


      return res.status(500).json({

        success: false,

        message:
          "Could not release temporary seat holds",

        error:
          error.message,
      });
    }
  }
);


// ======================================================
// REFRESH CURRENT SELECTION
//
// POST /api/seat-holds/refresh
//
// Useful when passenger is still actively
// choosing seats.
//
// Body:
// {
//   busId,
//   journeyDate,
//   selectionId
// }
// ======================================================

router.post(
  "/refresh",
  protect,
  async (req, res) => {

    try {

      const {
        busId,
        journeyDate,
        selectionId,
      } = req.body;


      if (
        !busId ||
        !journeyDate ||
        !selectionId
      ) {

        return res.status(400).json({
          success: false,

          message:
            "busId, journeyDate and selectionId are required",
        });
      }


      const newExpiry =
        new Date(
          Date.now() +
          CLICK_HOLD_MS
        );


      const result =
        await SeatLock.updateMany(
          {
            busId,

            journeyDate,

            userId:
              req.user.id,

            selectionId,

            status:
              "held",

            bookingId:
              null,
          },

          {
            $set: {
              expiresAt:
                newExpiry,
            },
          }
        );


      return res.json({

        success: true,

        message:
          "Seat hold refreshed",

        modifiedCount:
          result.modifiedCount,

        expiresAt:
          newExpiry,
      });


    } catch (error) {

      console.error(
        "Seat hold refresh error:",
        error
      );


      return res.status(500).json({

        success: false,

        message:
          "Could not refresh seat hold",

        error:
          error.message,
      });
    }
  }
);


// ======================================================
// EXPORT
// ======================================================

module.exports = router;