
const {
  SEAT_PATTERN,
  COUNTER_SEATS,
} = require("./seatLayout");

// ==========================================
// RAJABUS - SUPPORTED BUS CAPACITIES
// ==========================================

const SUPPORTED_CAPACITIES = Object.freeze([
  50,
  54,
]);

// ==========================================
// EXACT 50-SEAT LAYOUT
// Reference: User provided screenshot
//
// Driver is on the LEFT.
// 13 Columns x 6 Rows.
// Center walking aisle.
// ==========================================

const FIFTY_SEAT_ROWS = [

  // Upper row 1
  [
    "04", "08", "12", "16", "20",
    "24", "28", "32", "36", "40",
    "42", "44", "50",
  ],

  // Upper row 2
  [
    "03", "07", "11", "15", "19",
    "23", "27", "31", "35", "39",
    "41", "43", "49",
  ],

  // Center aisle - rear seat 48
  [
    "x", "x", "x", "x", "x",
    "x", "x", "x", "x", "x",
    "x", "x", "48",
  ],

  // Center aisle - rear seat 47
  [
    "x", "x", "x", "x", "x",
    "x", "x", "x", "x", "x",
    "x", "x", "47",
  ],

  // Lower row 1
  [
    "02", "06", "10", "14", "18",
    "22", "26", "30", "34", "38",
    "x", "x", "46",
  ],

  // Lower row 2
  [
    "01", "05", "09", "13", "17",
    "21", "25", "29", "33", "37",
    "x", "x", "45",
  ],

];

// ==========================================
// 50-SEAT COUNTER SEATS
// Orange seats in screenshot
// ==========================================

const FIFTY_COUNTER_SEATS = [
  "01", "02", "03", "04",
  "05", "06", "07", "08",
  "44", "45", "46", "47",
  "48", "49", "50",
];

// ==========================================
// GET BUS SEAT LAYOUT
// ==========================================

function getBusSeatLayout(capacity = 54) {

  const count = Number(capacity);

  if (
    !Number.isInteger(count) ||
    !SUPPORTED_CAPACITIES.includes(count)
  ) {
    throw new Error(
      "Only 50 and 54 seat buses are supported"
    );
  }

  let pattern;
  let columns;
  let counterSeats;

  // ========================================
  // 50 SEATS - EXACT SCREENSHOT LAYOUT
  // ========================================

  if (count === 50) {

    columns = 13;

    pattern = FIFTY_SEAT_ROWS.flat();

    counterSeats = [
      ...FIFTY_COUNTER_SEATS,
    ];

  } else {

    // ======================================
    // 54 SEATS - EXISTING ORIGINAL LAYOUT
    // ======================================

    columns = 11;

    pattern = [...SEAT_PATTERN];

    counterSeats = [...COUNTER_SEATS];
  }

  // ========================================
  // VALIDATE PHYSICAL SEATS
  // ========================================

  const allSeats = pattern.filter(
    (seat) => seat !== "x"
  );

  const seatSet = new Set(allSeats);

  const expectedSeats = Array.from(
    { length: count },
    (_, index) =>
      String(index + 1).padStart(2, "0")
  );

  if (
    pattern.length % columns !== 0 ||
    allSeats.length !== count ||
    seatSet.size !== count ||
    expectedSeats.some(
      (seat) => !seatSet.has(seat)
    )
  ) {
    throw new Error(
      `Invalid ${count}-seat layout`
    );
  }

  // ========================================
  // VALIDATE COUNTER SEATS
  // ========================================

  const counterSet = new Set(counterSeats);

  if (
    counterSeats.length !== 15 ||
    counterSet.size !== 15 ||
    counterSeats.some(
      (seat) => !seatSet.has(seat)
    )
  ) {
    throw new Error(
      "Invalid counter seat configuration"
    );
  }

  // ========================================
  // ONLINE BOOKABLE SEATS
  // ========================================

  const bookableSeats = allSeats.filter(
    (seat) => !counterSet.has(seat)
  );

  // ========================================
  // RETURN BUS LAYOUT
  // ========================================

  return {
    totalSeats: count,
    columns,
    pattern,
    counterSeats,
    bookableSeats,
  };
}

// ==========================================
// EXPORTS
// ==========================================

module.exports = {
  SUPPORTED_CAPACITIES,
  getBusSeatLayout,
};
