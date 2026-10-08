
"use strict";

// ======================================================
// RAJABUS - TRIP BASED REAL-TIME SEAT UPDATES
//
// Each scheduled trip has its own SSE client group.
//
// Trip A + Seat 12 -> held
// Trip B + Seat 12 -> unaffected
//
// Actions:
// held     -> ORANGE
// booked   -> RED
// released -> AVAILABLE
// ======================================================

const clientsByTrip = new Map();


// ======================================================
// CREATE TRIP KEY
// ======================================================

function tripKey(tripId) {
  return tripId == null
    ? ""
    : String(tripId).trim();
}


// ======================================================
// SUBSCRIBE USER
//
// Called from realtimeRoutes.js:
//
// subscribe(tripId, res)
// ======================================================

function subscribe(tripId, res) {
  const key = tripKey(tripId);

  if (!key) {
    throw new Error(
      "tripId is required for real-time subscription"
    );
  }

  // Create a new client group for this trip.
  if (!clientsByTrip.has(key)) {
    clientsByTrip.set(key, new Set());
  }

  const clients = clientsByTrip.get(key);

  // Register this browser connection.
  clients.add(res);

  console.log(
    `[SSE] Client subscribed to trip ${key}. ` +
    `Connected clients: ${clients.size}`
  );

  // The connected event and heartbeat are handled
  // by realtimeRoutes.js, so they are not duplicated here.

  let unsubscribed = false;

  // ====================================================
  // UNSUBSCRIBE
  // ====================================================

  return function unsubscribe() {
    if (unsubscribed) {
      return;
    }

    unsubscribed = true;

    clients.delete(res);

    if (clients.size === 0) {
      clientsByTrip.delete(key);
    }

    console.log(
      `[SSE] Client disconnected from trip ${key}`
    );
  };
}


// ======================================================
// BROADCAST REAL-TIME SEAT UPDATE
//
// Usage:
//
// broadcastSeatUpdate({
//   tripId,
//   busId,
//   journeyDate,
//   seats: ["12"],
//   action: "held",
//   bookingId,
//   status: "Pending",
//   expiresAt
// });
//
// IMPORTANT:
// tripId is REQUIRED.
// No fallback to busId + journeyDate.
// ======================================================

function broadcastSeatUpdate({
  tripId,
  busId,
  journeyDate,
  seats,
  action,
  bookingId = null,
  status = null,
  expiresAt = null,
} = {}) {

  // ====================================================
  // VALIDATE TRIP
  // ====================================================

  const key = tripKey(tripId);

  if (!key) {
    console.warn(
      "[SSE] Broadcast skipped: tripId is missing"
    );
    return 0;
  }

  // ====================================================
  // VALIDATE ACTION
  // ====================================================

  const validActions = [
    "held",
    "booked",
    "released",
  ];

  if (!validActions.includes(action)) {
    console.warn(
      `[SSE] Invalid seat action: ${action}`
    );
    return 0;
  }

  // ====================================================
  // NORMALIZE SEATS
  // ====================================================

  const normalizedSeats = [
    ...new Set(
      (Array.isArray(seats) ? seats : [])
        .filter((seat) => seat != null)
        .map((seat) => String(seat).trim())
        .filter(Boolean)
    ),
  ];

  if (normalizedSeats.length === 0) {
    return 0;
  }

  // ====================================================
  // FIND CLIENTS VIEWING THIS SPECIFIC TRIP
  // ====================================================

  const clients = clientsByTrip.get(key);

  if (!clients || clients.size === 0) {
    return 0;
  }

  // ====================================================
  // FORMAT EXPIRY TIME
  // ====================================================

  let formattedExpiresAt = null;

  if (expiresAt) {
    const expiryDate = new Date(expiresAt);

    if (!Number.isNaN(expiryDate.getTime())) {
      formattedExpiresAt = expiryDate.toISOString();
    }
  }

  // ====================================================
  // BUILD PAYLOAD
  // ====================================================

  const payload = JSON.stringify({
    tripId: key,

    busId: busId
      ? String(busId)
      : null,

    journeyDate: journeyDate
      ? String(journeyDate)
      : null,

    seats: normalizedSeats,

    action,

    bookingId: bookingId
      ? String(bookingId)
      : null,

    status: status || null,

    expiresAt: formattedExpiresAt,

    timestamp: new Date().toISOString(),
  });

  // ====================================================
  // SEND UPDATE TO ALL CLIENTS IN THIS TRIP
  // ====================================================

  let delivered = 0;

  for (const res of [...clients]) {
    // Remove disconnected browser connections.
    if (
      res.destroyed ||
      res.writableEnded
    ) {
      clients.delete(res);
      continue;
    }

    try {
      res.write(
        `event: seat-update\n` +
        `data: ${payload}\n\n`
      );

      delivered++;

    } catch (error) {
      console.error(
        `[SSE] Failed to send update for trip ${key}:`,
        error.message
      );

      clients.delete(res);
    }
  }

  // ====================================================
  // REMOVE EMPTY GROUP
  // ====================================================

  if (clients.size === 0) {
    clientsByTrip.delete(key);
  }

  console.log(
    `[SSE] Trip ${key} | ` +
    `Action: ${action} | ` +
    `Seats: ${normalizedSeats.join(", ")} | ` +
    `Connections: ${delivered}`
  );

  return delivered;
}


// ======================================================
// EXPORT
// ======================================================

module.exports = {
  subscribe,
  broadcastSeatUpdate,
};
