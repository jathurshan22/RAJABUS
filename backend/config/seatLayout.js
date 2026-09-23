// Shared physical seat layout for every bus in the Raja Bus fleet.
// Must stay in sync with the frontend's seat.js pattern.

const SEAT_PATTERN = [
  "05", "10", "15", "20", "25", "30", "35", "40", "45", "48", "54",
  "04", "09", "14", "19", "24", "29", "34", "39", "44", "47", "53",
  "03", "08", "13", "18", "23", "28", "33", "38", "43", "46", "52",
  "x", "x", "x", "x", "x", "x", "x", "x", "x", "x", "51",
  "02", "07", "12", "17", "22", "27", "32", "37", "42", "x", "50",
  "01", "06", "11", "16", "21", "26", "31", "36", "41", "x", "49",
];

const COUNTER_SEATS = [
  "01", "02", "03", "04", "05", "06", "07",
  "47", "48", "49", "50", "51", "52", "53", "54",
];

const ALL_SEATS = SEAT_PATTERN.filter((s) => s !== "x");
const TOTAL_SEATS = ALL_SEATS.length; // 54
const BOOKABLE_SEATS = ALL_SEATS.filter((s) => !COUNTER_SEATS.includes(s));

module.exports = {
  SEAT_PATTERN,
  COUNTER_SEATS,
  ALL_SEATS,
  TOTAL_SEATS,
  BOOKABLE_SEATS,
};
