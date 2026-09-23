const PDFDocument = require("pdfkit");

const BRAND_ORANGE = "#f26522";
const DARK_TEXT = "#111827";
const MUTED_TEXT = "#6b7280";
const LIGHT_BG = "#f8f8f8";

const statusColor = (status) => {
  if (status === "Paid") return "#0b9444";
  if (status === "Cancelled") return "#dc2626";
  return "#b45309"; // Pending
};

// Streams a PDF ticket for the given booking directly into the response.
const generateTicketPdf = async (booking, res) => {
  const ticketId = booking.ticketId || String(booking._id).slice(-6).toUpperCase();

  const doc = new PDFDocument({ size: "A4", margin: 50 });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${ticketId}.pdf"`);

  doc.pipe(res);

  // ── Header ──────────────────────────────────────────────
  doc
    .rect(0, 0, doc.page.width, 90)
    .fill(BRAND_ORANGE);

  doc
    .fillColor("#fff")
    .fontSize(22)
    .font("Helvetica-Bold")
    .text("RAJA BUS", 50, 30);

  doc
    .fillColor("#fff")
    .fontSize(11)
    .font("Helvetica")
    .text("E-Ticket / Booking Confirmation", 50, 58);

  doc
    .fillColor("#fff")
    .fontSize(11)
    .font("Helvetica-Bold")
    .text(ticketId, 0, 40, { align: "right", width: doc.page.width - 50 });

  doc.moveDown(4);
  doc.y = 120;

  // ── Status badge ────────────────────────────────────────
  const status = booking.status || "Pending";
  doc
    .fontSize(10)
    .font("Helvetica-Bold")
    .fillColor(statusColor(status))
    .text(status.toUpperCase(), 50, 120);

  // ── Route ───────────────────────────────────────────────
  doc.moveDown(1.5);
  doc.y = 150;

  doc
    .fillColor(DARK_TEXT)
    .fontSize(18)
    .font("Helvetica-Bold")
    .text(`${booking.boardingPoint || booking.from || "-"}  ->  ${booking.droppingPoint || booking.to || "-"}`, 50, 150, {
      width: doc.page.width - 100,
    });

  doc
    .fillColor(MUTED_TEXT)
    .fontSize(10)
    .font("Helvetica")
    .text(`Bus No: ${booking.busNo || "N/A"}`, 50, 178);

  // ── Details box ─────────────────────────────────────────
  const boxTop = 210;
  const boxLeft = 50;
  const boxWidth = doc.page.width - 100;

  doc
    .roundedRect(boxLeft, boxTop, boxWidth, 190, 8)
    .fillAndStroke(LIGHT_BG, "#eee");

  const rows = [
    ["Passenger", booking.passengerName || "N/A"],
    ["Mobile", booking.mobileNo || "N/A"],
    ["Email", booking.email || "N/A"],
    ["Journey Date", booking.journeyDate || "N/A"],
    ["Departure Time", booking.departTime || "N/A"],
    ["Seat(s)", booking.selectedSeats || (booking.seats || []).join(", ") || "N/A"],
    ["Total Fare", `Rs. ${booking.totalFare || 0}`],
  ];

  let rowY = boxTop + 20;
  rows.forEach(([label, value]) => {
    doc
      .fillColor(MUTED_TEXT)
      .fontSize(10)
      .font("Helvetica")
      .text(label, boxLeft + 20, rowY, { width: 150 });

    doc
      .fillColor(DARK_TEXT)
      .fontSize(11)
      .font("Helvetica-Bold")
      .text(String(value), boxLeft + 180, rowY, { width: boxWidth - 200 });

    rowY += 23;
  });

  // ── Footer ──────────────────────────────────────────────
  doc
    .fillColor(MUTED_TEXT)
    .fontSize(9)
    .font("Helvetica")
    .text(
      "Please carry a valid ID matching the passenger name. Show this ticket (printed or on your phone) to the conductor when boarding.",
      50,
      boxTop + 210,
      { width: boxWidth, align: "center" }
    );

  doc
    .fillColor(MUTED_TEXT)
    .fontSize(9)
    .text("Thank you for choosing Raja Bus.", 50, boxTop + 230, {
      width: boxWidth,
      align: "center",
    });

  doc.end();
};

module.exports = generateTicketPdf;
