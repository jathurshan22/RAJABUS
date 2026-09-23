const express = require("express");

const {
  subscribe,
} = require("../utils/realtimeSeats");

const router = express.Router();


// GET /api/realtime/seats
router.get("/seats", (req, res) => {

  const {
    busId,
    date,
  } = req.query;


  if (!busId || !date) {
    return res.status(400).json({
      success: false,
      message:
        "busId and date are required",
    });
  }


  // SSE headers
  res.setHeader(
    "Content-Type",
    "text/event-stream"
  );

  res.setHeader(
    "Cache-Control",
    "no-cache, no-transform"
  );

  res.setHeader(
    "Connection",
    "keep-alive"
  );

  res.setHeader(
    "X-Accel-Buffering",
    "no"
  );


  if (res.flushHeaders) {
    res.flushHeaders();
  }


  const unsubscribe =
    subscribe(
      busId,
      date,
      res
    );


  req.on("close", () => {
    unsubscribe();
  });
});


module.exports = router;