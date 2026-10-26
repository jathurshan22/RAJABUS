
const { SEAT_PATTERN } = require("./seatLayout");

// Supported physical bus capacities
const SUPPORTED_CAPACITIES = Object.freeze([
  52,
  54,
  56,
]);

function getBusSeatLayout(capacity = 54) {
  const count = Number(capacity);

  if (
    !Number.isInteger(count) ||
    !SUPPORTED_CAPACITIES.includes(count)
  ) {
    throw new Error(
      "Supported bus seat capacities: 52, 54, 56"
    );
  }

  // Preserve the existing 54-seat arrangement
  const pattern = [...SEAT_PATTERN];

  // 52-seat layout
  if (count === 52) {
    for (const seat of ["53", "54"]) {
      const index = pattern.indexOf(seat);

      if (index === -1) {
        throw new Error(
          `Base layout missing seat ${seat}`
        );
      }

      pattern[index] = "x";
    }
  }

  // 56-seat layout
  if (count === 56) {
    // Proposed additional positions in the
    // existing 6-row, 11-column seat grid.
    if (
      pattern[53] !== "x" ||
      pattern[64] !== "x"
    ) {
      throw new Error(
        "Expected expansion positions not available"
      );
    }

    pattern[53] = "55";
    pattern[64] = "56";
  }

  const allSeats = pattern.filter(
    (seat) => seat !== "x"
  );

  const formatSeat = (number) =>
    String(number).padStart(2, "0");

  // First 7 and last 8 seats are counter seats
  const counterSeats = [
    ...Array.from(
      { length: 7 },
      (_, i) => formatSeat(i + 1)
    ),
    ...Array.from(
      { length: 8 },
      (_, i) => formatSeat(count - 7 + i)
    ),
  ];

  const counterSet = new Set(counterSeats);

  const bookableSeats = allSeats.filter(
    (seat) => !counterSet.has(seat)
  );

  if (
    allSeats.length !== count ||
    new Set(allSeats).size !== count
  ) {
    throw new Error(
      "Invalid seat layout: missing or duplicate seats"
    );
  }

  return {
    totalSeats: count,
    pattern,
    counterSeats,
    bookableSeats,
  };
}

module.exports = {
  SUPPORTED_CAPACITIES,
  getBusSeatLayout,
};
