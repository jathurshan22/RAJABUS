
"use strict";

const express = require("express");
const mongoose = require("mongoose");
const PDFDocument = require("pdfkit");

const Trip = require("../models/Trip");
const Booking = require("../models/Booking");
const Bus = require("../models/Bus");

const {
  operatorProtect
} = require("../middleware/operatorAuth");

const router = express.Router();

// =============================================
// OPERATOR AUTHENTICATION
// =============================================

router.use(operatorProtect);

// =============================================
// VALIDATE DATE
// =============================================

function validDate(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return false;
  }

  const date = new Date(
    `${value}T00:00:00.000Z`
  );

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

// =============================================
// SAFE PDF TEXT
// =============================================

function text(value, fallback = "-") {
  const result = String(value ?? "")
    .replace(/[\r\n\t]/g, " ")
    .trim()
    .slice(0, 250);

  return result || fallback;
}

// =============================================
// EXTRACT BOOKED SEATS
// =============================================

function seatsFor(booking) {
  if (
    Array.isArray(booking.seats) &&
    booking.seats.length > 0
  ) {
    return booking.seats.map(String);
  }

  return String(
    booking.selectedSeats || ""
  )
    .split(",")
    .map((seat) => seat.trim())
    .filter(Boolean);
}

// =============================================
// GET DATE-WISE OPERATOR BUS BOOKINGS
// =============================================

async function dailyGroups(
  operatorId,
  date,
  requestedBusId = null
) {

  // Only this operator's trips.
  const tripFilter = {
    operatorId,
    journeyDate: date
  };

  if (requestedBusId) {
    tripFilter.busId = requestedBusId;
  }

  // =========================================
  // FIND ASSIGNED TRIPS
  // =========================================

  const trips = await Trip.find(tripFilter)
    .sort({
      departureTime: 1,
      _id: 1
    })
    .populate({
      path: "busId",

      // Prevent another operator's bus
      // from being included.
      match: {
        operatorId
      },

      select:
        "busNo regNo type totalSeats operatorId"
    })
    .lean();

  const ownedTrips = trips.filter(
    (trip) => trip.busId
  );

  const tripIds = ownedTrips.map(
    (trip) => trip._id
  );

  // =========================================
  // LOAD PASSENGER BOOKINGS
  // =========================================

  const bookings = tripIds.length
    ? await Booking.find({
        tripId: {
          $in: tripIds
        }
      })
        .select(
          "tripId ticketId passengerName " +
          "email mobileNo seats selectedSeats status"
        )
        .sort({
          createdAt: 1,
          _id: 1
        })
        .lean()
    : [];

  // =========================================
  // GROUP BOOKINGS BY TRIP
  // =========================================

  const bookingsByTrip = new Map();

  for (const booking of bookings) {

    const key = String(
      booking.tripId
    );

    if (!bookingsByTrip.has(key)) {
      bookingsByTrip.set(key, []);
    }

    bookingsByTrip.get(key).push({

      bookingId: String(
        booking._id
      ),

      ticketId:
        booking.ticketId || null,

      passengerName:
        booking.passengerName || null,

      email:
        booking.email || null,

      phoneNumber:
        booking.mobileNo || null,

      seats:
        seatsFor(booking),

      status:
        booking.status
    });
  }

  // =========================================
  // GROUP TRIPS BY BUS
  // =========================================

  const byBus = new Map();

  for (const trip of ownedTrips) {

    const busKey = String(
      trip.busId._id
    );

    if (!byBus.has(busKey)) {

      byBus.set(busKey, {

        busId: busKey,

        busNo:
          trip.busId.busNo,

        regNo:
          trip.busId.regNo,

        type:
          trip.busId.type,

        totalSeats:
          trip.busId.totalSeats,

        trips: [],

        totalBookings: 0,

        paidBookings: 0
      });
    }

    const group = byBus.get(busKey);

    const tripBookings =
      bookingsByTrip.get(
        String(trip._id)
      ) || [];

    // =======================================
    // ADD TRIP DETAILS
    // =======================================

    group.trips.push({

      tripId:
        String(trip._id),

      from:
        trip.from,

      to:
        trip.to,

      departureTime:
        trip.departureTime,

      arrivalTime:
        trip.arrivalTime,

      status:
        trip.status,

      bookings:
        tripBookings
    });

    // =======================================
    // BOOKING COUNTS
    // =======================================

    group.totalBookings +=
      tripBookings.length;

    group.paidBookings +=
      tripBookings.filter(
        (booking) =>
          booking.status === "Paid"
      ).length;
  }

  return [
    ...byBus.values()
  ];
}

// =============================================
// DAILY BOOKINGS API
//
// GET /api/operators/daily-bookings
// ?date=YYYY-MM-DD
// =============================================

router.get(
  "/daily-bookings",
  async (req, res) => {

    res.set(
      "Cache-Control",
      "private, no-store"
    );

    const date = req.query.date;

    // =======================================
    // VALIDATE DATE
    // =======================================

    if (!validDate(date)) {

      return res.status(400).json({
        success: false,

        message:
          "Valid date (YYYY-MM-DD) required"
      });
    }

    try {

      const buses = await dailyGroups(
        req.operator._id,
        date
      );

      // =====================================
      // TOTAL BOOKINGS
      // =====================================

      const totalBookings = buses.reduce(
        (sum, bus) =>
          sum + bus.totalBookings,
        0
      );

      // =====================================
      // PAID BOOKINGS
      // =====================================

      const paidBookings = buses.reduce(
        (sum, bus) =>
          sum + bus.paidBookings,
        0
      );

      return res.json({

        success: true,

        date,

        busCount:
          buses.length,

        totalBookings,

        paidBookings,

        buses
      });

    } catch (error) {

      console.error(
        "Daily operator bookings error:",
        error
      );

      return res.status(500).json({

        success: false,

        message:
          "Unable to load daily bookings"
      });
    }
  }
);

// =============================================
// PDF TABLE GENERATOR
// =============================================

function pdfSection(
  doc,
  title,
  rows
) {

  const left = 32;

  // Landscape A4 column widths.
  const widths = [
    92,
    154,
    201,
    114,
    87,
    116
  ];

  const headers = [
    "Ticket ID",
    "Passenger Name",
    "Email",
    "Phone",
    "Seat No.",
    "Status"
  ];

  // =========================================
  // DRAW TABLE HEADER
  // =========================================

  function headings() {

    if (doc.y > 500) {
      doc.addPage();
    }

    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .fillColor("#161616")
      .text(
        title,
        left,
        doc.y + 6
      );

    let x = left;

    const y = doc.y + 11;

    headers.forEach(
      (label, index) => {

        doc
          .rect(
            x,
            y,
            widths[index],
            22
          )
          .fill("#222222");

        doc
          .font("Helvetica-Bold")
          .fontSize(8)
          .fillColor("#ffffff")
          .text(
            label,
            x + 5,
            y + 6,
            {
              width:
                widths[index] - 10,

              lineBreak: false
            }
          );

        x += widths[index];
      }
    );

    doc.y = y + 22;
  }

  headings();

  // =========================================
  // NO PAID BOOKINGS
  // =========================================

  if (!rows.length) {

    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#666666")
      .text(
        "No paid passenger bookings for this trip.",
        left + 6,
        doc.y + 9
      );

    doc.y += 12;

    return;
  }

  // =========================================
  // PASSENGER TABLE ROWS
  // =========================================

  for (
    let index = 0;
    index < rows.length;
    index++
  ) {

    const row = rows[index];

    const cells = [

      text(row.ticketId),

      text(row.passengerName),

      text(row.email),

      text(row.phoneNumber),

      text(row.seats.join(", ")),

      text(row.status)
    ];

    doc
      .font("Helvetica")
      .fontSize(8);

    // =======================================
    // CALCULATE ROW HEIGHT
    // =======================================

    const heights = cells.map(
      (cell, column) =>
        doc.heightOfString(
          cell,
          {
            width:
              widths[column] - 10,

            lineGap: 2
          }
        )
    );

    const rowHeight = Math.max(
      25,
      Math.ceil(
        Math.max(...heights)
      ) + 11
    );

    // =======================================
    // PAGE BREAK
    // =======================================

    if (
      doc.y + rowHeight >
      doc.page.height - 35
    ) {

      doc.addPage();

      headings();
    }

    const y = doc.y;

    let x = left;

    // Alternate row background.
    if (index % 2 === 0) {

      const totalWidth = widths.reduce(
        (a, b) => a + b,
        0
      );

      doc
        .rect(
          left,
          y,
          totalWidth,
          rowHeight
        )
        .fill("#fff4eb");
    }

    // =======================================
    // WRITE ROW VALUES
    // =======================================

    cells.forEach(
      (cell, column) => {

        doc
          .font("Helvetica")
          .fontSize(8)
          .fillColor("#222222")
          .text(
            cell,
            x + 5,
            y + 5,
            {
              width:
                widths[column] - 10,

              lineGap: 2
            }
          );

        x += widths[column];
      }
    );

    doc.y = y + rowHeight;
  }

  doc.y += 12;
}

// =============================================
// DOWNLOAD PASSENGER LIST PDF
//
// GET /api/operators/daily-bookings/:busId/pdf
// ?date=YYYY-MM-DD
// =============================================

router.get(
  "/daily-bookings/:busId/pdf",
  async (req, res) => {

    res.set(
      "Cache-Control",
      "private, no-store"
    );

    const {
      busId
    } = req.params;

    const {
      date
    } = req.query;

    // =======================================
    // VALIDATE BUS ID AND DATE
    // =======================================

    if (
      !validDate(date) ||
      !mongoose.isValidObjectId(busId)
    ) {

      return res.status(400).json({

        success: false,

        message:
          "Valid bus ID and date required"
      });
    }

    try {

      // =====================================
      // VERIFY BUS OWNERSHIP
      // =====================================

      const bus = await Bus.findOne({

        _id: busId,

        operatorId:
          req.operator._id

      })
        .select("busNo regNo")
        .lean();

      if (!bus) {

        return res.status(404).json({

          success: false,

          message:
            "Bus not found"
        });
      }

      // =====================================
      // GET THIS BUS'S DAILY TRIPS
      // =====================================

      const groups = await dailyGroups(
        req.operator._id,
        date,
        busId
      );

      if (!groups.length) {

        return res.status(404).json({

          success: false,

          message:
            "No assigned trips for this bus on this date"
        });
      }

      const group = groups[0];

      // =====================================
      // PDF RESPONSE
      // =====================================

      const filename =
        `RAJABUS-${date}-` +
        `${String(bus._id)}-passenger-list.pdf`;

      res.set(
        "Content-Type",
        "application/pdf"
      );

      res.set(
        "Content-Disposition",
        `attachment; filename="${filename}"`
      );

      // =====================================
      // CREATE PDF DOCUMENT
      // =====================================

      const doc = new PDFDocument({

        size: "A4",

        layout: "landscape",

        margin: 32,

        bufferPages: false
      });

      doc.pipe(res);

      // =====================================
      // PDF TITLE
      // =====================================

      doc
        .font("Helvetica-Bold")
        .fontSize(18)
        .fillColor("#f26522")
        .text(
          "RAJABUS - DAILY PASSENGER LIST"
        );

      // =====================================
      // COMPANY DETAILS
      // =====================================

      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor("#333333")

        .text(
          `Company: ${text(
            req.operator.companyName
          )}`
        )

        .text(
          `Journey date: ${date}    ` +
          `Bus: ${text(bus.busNo)}    ` +
          `Registration: ${text(bus.regNo)}`
        )

        .text(
          `Confirmed (Paid) bookings: ` +
          `${group.paidBookings}`
        )

        .moveDown(0.6);

      // =====================================
      // EACH TRIP HAS ITS OWN TABLE
      // =====================================

      for (const trip of group.trips) {

        const title =
          `${text(trip.from)} to ` +
          `${text(trip.to)} | ` +
          `${text(trip.departureTime)} - ` +
          `${text(trip.arrivalTime)} | ` +
          `${text(trip.status)}`;

        // Only confirmed paid passengers
        // are included in boarding PDF.

        const confirmedBookings =
          trip.bookings.filter(
            (booking) =>
              booking.status === "Paid"
          );

        pdfSection(
          doc,
          title,
          confirmedBookings
        );
      }

      // =====================================
      // FINISH PDF
      // =====================================

      doc.end();

    } catch (error) {

      console.error(
        "Operator PDF error:",
        error
      );

      if (!res.headersSent) {

        return res.status(500).json({

          success: false,

          message:
            "Unable to generate passenger PDF"
        });

      } else {

        res.destroy(error);
      }
    }
  }
);

// =============================================
// EXPORT ROUTER
// =============================================

module.exports = router;
