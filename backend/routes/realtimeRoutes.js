const express = require("express");

const {
  subscribe,
} = require("../utils/realtimeSeats");


const router = express.Router();


// ======================================================
// REAL-TIME SEAT UPDATES
//
// GET:
// /api/realtime/seats?busId=BUS_ID&date=2026-09-30
//
// SSE = Server-Sent Events
// ======================================================

router.get(
  "/seats",
  (req, res) => {

    const {
      busId,
      date,
    } = req.query;


    // --------------------------------------------------
    // VALIDATION
    // --------------------------------------------------

    if (
      !busId ||
      !date
    ) {
      return res
        .status(400)
        .json({
          success: false,

          message:
            "busId and date are required",
        });
    }


    // --------------------------------------------------
    // SSE HEADERS
    // --------------------------------------------------

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

    // Prevent proxy buffering
    res.setHeader(
      "X-Accel-Buffering",
      "no"
    );


    // Send headers immediately
    if (
      typeof res.flushHeaders ===
      "function"
    ) {
      res.flushHeaders();
    }


    // --------------------------------------------------
    // BROWSER RECONNECT TIME
    //
    // If SSE connection disconnects,
    // browser reconnects after 3 seconds.
    // --------------------------------------------------

    res.write(
      "retry: 3000\n\n"
    );


    // --------------------------------------------------
    // SUBSCRIBE USER
    // --------------------------------------------------

    const unsubscribe =
      subscribe(
        busId,
        date,
        res
      );


    let closed =
      false;


    // --------------------------------------------------
    // CLEANUP CONNECTION
    // --------------------------------------------------

    function cleanup() {

      if (closed) {
        return;
      }


      closed =
        true;


      unsubscribe();


      console.log(
        `Real-time connection closed: ${busId} / ${date}`
      );
    }


    // User closes tab / modal / browser
    req.on(
      "close",
      cleanup
    );


    res.on(
      "close",
      cleanup
    );
  }
);


module.exports = router;