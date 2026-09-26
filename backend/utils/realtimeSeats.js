const clientsByTrip = new Map();


// ======================================================
// CREATE UNIQUE KEY FOR BUS + JOURNEY DATE
// ======================================================

function tripKey(busId, journeyDate) {
  return `${String(busId)}::${String(journeyDate)}`;
}


// ======================================================
// SUBSCRIBE USER TO REAL-TIME SEAT UPDATES
// ======================================================

function subscribe(busId, journeyDate, res) {
  const key =
    tripKey(
      busId,
      journeyDate
    );


  if (
    !clientsByTrip.has(key)
  ) {
    clientsByTrip.set(
      key,
      new Set()
    );
  }


  const clients =
    clientsByTrip.get(key);


  clients.add(res);


  // ----------------------------------------------------
  // CONNECTION SUCCESS MESSAGE
  // ----------------------------------------------------

  try {
    res.write(
      `event: connected\ndata: ${JSON.stringify({
        busId:
          String(busId),

        journeyDate:
          String(journeyDate),

        timestamp:
          new Date().toISOString(),
      })}\n\n`
    );

  } catch (error) {
    clients.delete(res);
  }


  // ----------------------------------------------------
  // UNSUBSCRIBE
  // ----------------------------------------------------

  return () => {
    clients.delete(res);


    if (
      clients.size === 0
    ) {
      clientsByTrip.delete(
        key
      );
    }
  };
}


// ======================================================
// BROADCAST SEAT UPDATE
//
// action:
// held     → ORANGE
// booked   → RED
// released → AVAILABLE
// ======================================================

function broadcastSeatUpdate({
  busId,
  journeyDate,
  seats,
  action,
  bookingId,
  status,
  expiresAt = null,
}) {
  if (
    !busId ||
    !journeyDate
  ) {
    return;
  }


  const key =
    tripKey(
      busId,
      journeyDate
    );


  const clients =
    clientsByTrip.get(key);


  if (
    !clients ||
    clients.size === 0
  ) {
    return;
  }


  // ----------------------------------------------------
  // PAYLOAD
  // ----------------------------------------------------

  const payload =
    JSON.stringify({
      busId:
        String(busId),

      journeyDate:
        String(journeyDate),

      seats:
        Array.isArray(seats)
          ? seats.map(String)
          : [],

      action,

      bookingId:
        bookingId
          ? String(bookingId)
          : null,

      status:
        status || null,

      // Useful for held seats
      expiresAt:
        expiresAt
          ? new Date(
              expiresAt
            ).toISOString()
          : null,

      timestamp:
        new Date().toISOString(),
    });


  // ----------------------------------------------------
  // SEND TO ALL USERS VIEWING SAME BUS + DATE
  // ----------------------------------------------------

  for (
    const res
    of [...clients]
  ) {
    try {
      res.write(
        `event: seat-update\ndata: ${payload}\n\n`
      );

    } catch (error) {
      // Dead connection
      clients.delete(res);
    }
  }


  // Remove empty trip group
  if (
    clients.size === 0
  ) {
    clientsByTrip.delete(
      key
    );
  }
}


// ======================================================
// HEARTBEAT
//
// Keeps SSE connection alive.
// ======================================================

const heartbeat =
  setInterval(
    () => {

      for (
        const [
          key,
          clients,
        ]
        of clientsByTrip.entries()
      ) {

        for (
          const res
          of [...clients]
        ) {

          try {
            res.write(
              `: heartbeat ${Date.now()}\n\n`
            );

          } catch (error) {
            clients.delete(res);
          }
        }


        if (
          clients.size === 0
        ) {
          clientsByTrip.delete(
            key
          );
        }
      }

    },
    25000
  );


if (
  typeof heartbeat.unref ===
  "function"
) {
  heartbeat.unref();
}


// ======================================================
// EXPORT
// ======================================================

module.exports = {
  subscribe,
  broadcastSeatUpdate,
};