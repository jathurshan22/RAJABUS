
const Booking = require("../models/Booking");
const SeatLock = require("../models/SeatLock");

const {
  broadcastSeatUpdate,
} = require("./realtimeSeats");


// ======================================================
// SETTINGS
// ======================================================

const CLEANUP_INTERVAL_MS = 5000;

let cleanupRunning = false;
let cleanupInterval = null;


// ======================================================
// BROADCAST RELEASED SEATS
//
// Each trip receives only its own seat updates.
// ======================================================

function broadcastReleasedLocks(locks) {
  const groups = new Map();

  for (const lock of locks) {
    const tripId = lock.tripId;

    if (!tripId) {
      console.warn(
        "[CLEANUP] Trip ID missing for seat:",
        lock.seat
      );
      continue;
    }

    const key = String(tripId);

    if (!groups.has(key)) {
      groups.set(key, {
        tripId,
        busId: lock.busId,
        journeyDate: lock.journeyDate,
        seats: new Set(),
      });
    }

    groups.get(key).seats.add(
      String(lock.seat)
    );
  }

  for (const group of groups.values()) {
    broadcastSeatUpdate({
      tripId: group.tripId,
      busId: group.busId,
      journeyDate: group.journeyDate,
      seats: [...group.seats],
      action: "released",
      status: "Expired",
    });

    console.log(
      `[CLEANUP] Trip ${group.tripId}: ` +
      `Released seats ${[...group.seats].join(", ")}`
    );
  }
}


// ======================================================
// DELETE HELD LOCKS SAFELY
//
// Only status = held is deleted.
// Booked seats must never be deleted here.
// ======================================================

async function deleteHeldLocks(filter) {
  const locks = await SeatLock.find({
    ...filter,
    status: "held",
  });

  const deletedLocks = [];

  for (const lock of locks) {
    const deleted =
      await SeatLock.findOneAndDelete({
        _id: lock._id,
        status: "held",
      });

    if (deleted) {
      deletedLocks.push(deleted);
    }
  }

  return deletedLocks;
}


// ======================================================
// EXPIRE PENDING BOOKING
//
// Booking must be Pending.
// Hold expiry must have passed.
// ======================================================

async function expirePendingBooking(
  booking,
  now
) {
  // ----------------------------------------------------
  // PAYMENT SAFETY CHECK
  //
  // If payment processing has already changed
  // any seat to booked, skip automatic expiry.
  // ----------------------------------------------------

  const bookedLock = await SeatLock.exists({
    bookingId: booking._id,
    status: "booked",
  });

  if (bookedLock) {
    console.warn(
      "[CLEANUP] Skipped booking with booked seats:",
      String(booking._id)
    );

    return;
  }

  // ----------------------------------------------------
  // MARK BOOKING EXPIRED
  //
  // Conditional update:
  // Only an expired Pending booking can change.
  // ----------------------------------------------------

  const expiredBooking =
    await Booking.findOneAndUpdate(
      {
        _id: booking._id,
        status: "Pending",
        holdExpiresAt: {
          $lte: now,
        },
      },
      {
        $set: {
          status: "Expired",
          holdExpiresAt: null,
        },
      },
      {
        new: true,
      }
    );

  if (!expiredBooking) {
    return;
  }

  // ----------------------------------------------------
  // RELEASE ALL HELD SEATS FOR THIS BOOKING
  // ----------------------------------------------------

  const deletedLocks = await deleteHeldLocks({
    bookingId: expiredBooking._id,
  });

  // ----------------------------------------------------
  // REAL-TIME RELEASE
  // ----------------------------------------------------

  if (deletedLocks.length > 0) {
    broadcastReleasedLocks(deletedLocks);
  }

  console.log(
    "[CLEANUP] Booking expired:",
    expiredBooking.ticketId ||
      String(expiredBooking._id)
  );
}


// ======================================================
// CLEAN ORPHAN / OLD EXPIRED LOCKS
//
// Handles:
// 1. Booking was deleted
// 2. Booking is already Expired
// 3. Booking is already Cancelled
// 4. Temporary lock without bookingId
//
// Does NOT release Paid booking seats.
// ======================================================

async function cleanupOrphanLocks(now) {
  const expiredLocks = await SeatLock.find({
    status: "held",
    expiresAt: {
      $ne: null,
      $lte: now,
    },
  });

  const deletedLocks = [];

  for (const lock of expiredLocks) {
    // --------------------------------------------------
    // TEMPORARY SELECTION WITHOUT BOOKING
    // --------------------------------------------------

    if (!lock.bookingId) {
      const deleted =
        await SeatLock.findOneAndDelete({
          _id: lock._id,
          status: "held",
          bookingId: null,
          expiresAt: {
            $lte: now,
          },
        });

      if (deleted) {
        deletedLocks.push(deleted);
      }

      continue;
    }

    // --------------------------------------------------
    // CHECK RELATED BOOKING
    // --------------------------------------------------

    const booking = await Booking.findById(
      lock.bookingId
    ).select("status");

    // Never delete held locks of Pending bookings
    // here. They are handled by expirePendingBooking.
    //
    // Never delete Paid booking locks automatically.

    if (
      booking &&
      (
        booking.status === "Pending" ||
        booking.status === "Paid"
      )
    ) {
      continue;
    }

    // --------------------------------------------------
    // BOOKING MISSING / CANCELLED / EXPIRED
    // --------------------------------------------------

    const deleted =
      await SeatLock.findOneAndDelete({
        _id: lock._id,
        status: "held",
        expiresAt: {
          $lte: now,
        },
      });

    if (deleted) {
      deletedLocks.push(deleted);
    }
  }

  if (deletedLocks.length > 0) {
    broadcastReleasedLocks(deletedLocks);
  }
}


// ======================================================
// MAIN CLEANUP FUNCTION
// ======================================================

async function cleanupExpiredHolds() {
  // Prevent overlapping cleanup runs.
  if (cleanupRunning) {
    return;
  }

  cleanupRunning = true;

  try {
    const now = new Date();

    // ==================================================
    // FIND ALL EXPIRED PENDING BOOKINGS
    //
    // Even if their SeatLock documents are missing.
    // ==================================================

    const expiredBookings = await Booking.find({
      status: "Pending",
      holdExpiresAt: {
        $ne: null,
        $lte: now,
      },
    });

    // ==================================================
    // PROCESS EXPIRED BOOKINGS
    // ==================================================

    for (const booking of expiredBookings) {
      try {
        await expirePendingBooking(
          booking,
          now
        );
      } catch (error) {
        console.error(
          "[CLEANUP] Failed booking:",
          String(booking._id),
          error.message
        );
      }
    }

    // ==================================================
    // CLEAN ORPHAN / TEMPORARY EXPIRED LOCKS
    // ==================================================

    await cleanupOrphanLocks(now);

  } catch (error) {
    console.error(
      "[CLEANUP] Error:",
      error
    );

  } finally {
    cleanupRunning = false;
  }
}


// ======================================================
// START AUTOMATIC CLEANUP
// ======================================================

function startHoldCleanup() {
  // Avoid starting multiple cleanup timers.
  if (cleanupInterval) {
    return cleanupInterval;
  }

  console.log(
    "[CLEANUP] Trip-based seat cleanup started"
  );

  // Run once when the backend starts.
  cleanupExpiredHolds().catch(
    console.error
  );

  // Check every 5 seconds.
  cleanupInterval = setInterval(
    () => {
      cleanupExpiredHolds().catch(
        console.error
      );
    },
    CLEANUP_INTERVAL_MS
  );

  if (
    typeof cleanupInterval.unref === "function"
  ) {
    cleanupInterval.unref();
  }

  return cleanupInterval;
}


// ======================================================
// EXPORT
// ======================================================

module.exports = {
  cleanupExpiredHolds,
  startHoldCleanup,
};
