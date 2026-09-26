const Booking = require("../models/Booking");
const SeatLock = require("../models/SeatLock");

const {
  broadcastSeatUpdate,
} = require("./realtimeSeats");


// ======================================================
// CLEAN EXPIRED SEAT HOLDS
// ======================================================

async function cleanupExpiredHolds() {
  try {
    const now = new Date();


    // --------------------------------------------------
    // FIND EXPIRED HELD SEATS
    // --------------------------------------------------

    const expiredLocks =
      await SeatLock.find({
        status: "held",

        expiresAt: {
          $ne: null,
          $lte: now,
        },
      });


    if (
      expiredLocks.length === 0
    ) {
      return;
    }


    // --------------------------------------------------
    // GROUP LOCKS BY BOOKING
    // --------------------------------------------------

    const bookingGroups =
      new Map();


    for (
      const lock
      of expiredLocks
    ) {

      const bookingId =
        String(
          lock.bookingId
        );


      if (
        !bookingGroups.has(
          bookingId
        )
      ) {

        bookingGroups.set(
          bookingId,
          []
        );
      }


      bookingGroups
        .get(bookingId)
        .push(lock);
    }


    // --------------------------------------------------
    // PROCESS EACH EXPIRED BOOKING
    // --------------------------------------------------

    for (
      const [
        bookingId,
        locks,
      ]
      of bookingGroups
    ) {

      const booking =
        await Booking.findById(
          bookingId
        );


      // Booking already deleted
      if (!booking) {

        await SeatLock.deleteMany({
          bookingId,
          status: "held",
        });

        continue;
      }


      // Paid booking should never expire
      if (
        booking.status ===
        "Paid"
      ) {

        continue;
      }


      // --------------------------------------------------
      // DELETE HELD SEATS
      // --------------------------------------------------

      await SeatLock.deleteMany({
        bookingId:
          booking._id,

        status:
          "held",
      });


      // --------------------------------------------------
      // MARK BOOKING EXPIRED
      // --------------------------------------------------

      if (
        booking.status ===
        "Pending"
      ) {

        booking.status =
          "Expired";


        booking.holdExpiresAt =
          null;


        await booking.save();
      }


      // --------------------------------------------------
      // REAL-TIME RELEASE
      //
      // ORANGE → AVAILABLE
      // --------------------------------------------------

      broadcastSeatUpdate({

        busId:
          booking.busId,

        journeyDate:
          booking.journeyDate,

        seats:
          locks.map(
            (lock) =>
              String(
                lock.seat
              )
          ),

        action:
          "released",

        bookingId:
          booking._id,

        status:
          "Expired",
      });


      console.log(
        `Expired seat hold released: ${booking.ticketId || booking._id}`
      );
    }

  } catch (error) {

    console.error(
      "Hold cleanup error:",
      error
    );
  }
}


// ======================================================
// START AUTOMATIC CLEANUP
// ======================================================

function startHoldCleanup() {

  console.log(
    "Seat hold cleanup started"
  );


  // Run once when server starts
  cleanupExpiredHolds();


  // Check every 5 seconds
  const interval =
    setInterval(
      cleanupExpiredHolds,
      5000
    );


  // Does not keep Node process alive by itself
  if (
    typeof interval.unref ===
    "function"
  ) {

    interval.unref();
  }


  return interval;
}


module.exports = {
  cleanupExpiredHolds,
  startHoldCleanup,
};