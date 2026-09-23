const clientsByTrip = new Map();

function tripKey(busId, journeyDate) {
  return `${String(busId)}::${journeyDate}`;
}


// User real-time connection store pannum
function subscribe(busId, journeyDate, res) {
  const key = tripKey(busId, journeyDate);

  if (!clientsByTrip.has(key)) {
    clientsByTrip.set(key, new Set());
  }

  const clients = clientsByTrip.get(key);

  clients.add(res);


  // Connection successful message
  res.write(
    `event: connected\ndata: ${JSON.stringify({
      busId: String(busId),
      journeyDate,
    })}\n\n`
  );


  // Connection close aana remove pannum
  return () => {
    clients.delete(res);

    if (clients.size === 0) {
      clientsByTrip.delete(key);
    }
  };
}


// Seat booking/cancel update send pannum
function broadcastSeatUpdate({
  busId,
  journeyDate,
  seats,
  action,
  bookingId,
  status,
}) {
  const key = tripKey(
    busId,
    journeyDate
  );

  const clients =
    clientsByTrip.get(key);


  if (!clients || clients.size === 0) {
    return;
  }


  const payload = JSON.stringify({
    busId: String(busId),

    journeyDate,

    seats,

    action,

    bookingId: bookingId
      ? String(bookingId)
      : undefined,

    status,

    timestamp:
      new Date().toISOString(),
  });


  for (const res of clients) {
    res.write(
      `event: seat-update\ndata: ${payload}\n\n`
    );
  }
}


// Connection disconnect aagama heartbeat
setInterval(() => {
  for (
    const clients
    of clientsByTrip.values()
  ) {
    for (const res of clients) {
      res.write(
        `: heartbeat ${Date.now()}\n\n`
      );
    }
  }
}, 25000).unref();


module.exports = {
  subscribe,
  broadcastSeatUpdate,
};