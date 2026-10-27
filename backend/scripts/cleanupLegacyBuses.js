
require("dotenv").config();

const mongoose = require("mongoose");

// ==========================================
// RAJABUS LEGACY DATA CLEANUP
// ==========================================
// Only buses without operatorId are targeted.
// Their directly linked bookings and seatlocks
// are deleted in a MongoDB transaction.
//
// DRY RUN:
// node scripts/cleanupLegacyBuses.js
//
// EXECUTE:
// node scripts/cleanupLegacyBuses.js --execute --confirm=DELETE-LEGACY-DATA
// ==========================================

const MONGO_URI =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI;

const EXPECTED = {
  legacyBuses: 99,
  operatorBuses: 6,
  bookings: 20,
  seatLocks: 24,
  trips: 0,
};

const EXECUTE = process.argv.includes("--execute");

const CONFIRMED = process.argv.includes(
  "--confirm=DELETE-LEGACY-DATA"
);

async function main() {
  if (!MONGO_URI) {
    throw new Error(
      "MongoDB connection URI missing in .env"
    );
  }

  await mongoose.connect(MONGO_URI);

  console.log("MongoDB connected.");

  const db = mongoose.connection.db;

  const buses = db.collection("buses");
  const bookings = db.collection("bookings");
  const seatlocks = db.collection("seatlocks");
  const trips = db.collection("trips");

  // ------------------------------------------
  // FIND LEGACY BUSES
  // ------------------------------------------

  const legacyBuses = await buses
    .find(
      { operatorId: null },
      { projection: { _id: 1 } }
    )
    .toArray();

  const legacyIds = legacyBuses.map(
    (bus) => bus._id
  );

  // Match historical busId values stored
  // either as ObjectId or as String.

  const busIdVariants = legacyIds.flatMap(
    (id) => [id, String(id)]
  );

  const linkedFilter = {
    busId: {
      $in: busIdVariants,
    },
  };

  // ------------------------------------------
  // READ-ONLY PRECHECK
  // ------------------------------------------

  const [
    operatorCount,
    bookingCount,
    seatLockCount,
    tripCount,
  ] = await Promise.all([
    buses.countDocuments({
      operatorId: { $type: "objectId" },
    }),

    bookings.countDocuments(linkedFilter),

    seatlocks.countDocuments(linkedFilter),

    trips.countDocuments(linkedFilter),
  ]);

  const audit = {
    legacyBuses: legacyIds.length,
    operatorBuses: operatorCount,
    bookings: bookingCount,
    seatLocks: seatLockCount,
    trips: tripCount,
  };

  console.log("\nCURRENT DATABASE AUDIT:");
  console.table(audit);

  // ------------------------------------------
  // STRICT SAFETY VALIDATION
  // ------------------------------------------

  for (const [key, expected] of Object.entries(
    EXPECTED
  )) {
    if (audit[key] !== expected) {
      throw new Error(
        `SAFETY STOP: ${key} is ${audit[key]}, ` +
        `but expected ${expected}. ` +
        "Nothing was deleted."
      );
    }
  }

  if (!EXECUTE) {
    console.log(
      "\nDRY RUN PASSED. No records deleted."
    );
    console.log(
      "Review backups before executing cleanup."
    );
    return;
  }

  if (!CONFIRMED) {
    throw new Error(
      "Deletion requires the explicit " +
      "--confirm=DELETE-LEGACY-DATA argument."
    );
  }

  // ------------------------------------------
  // TRANSACTIONAL DELETE
  // ------------------------------------------

  const session = await mongoose.startSession();

  try {
    await session.withTransaction(
      async () => {
        // Verify the target bus IDs are still
        // legacy buses at transaction time.

        const currentLegacy = await buses
          .find(
            { operatorId: null },
            {
              session,
              projection: { _id: 1 },
            }
          )
          .toArray();

        const originalSet = new Set(
          legacyIds.map(String)
        );

        if (
          currentLegacy.length !==
            EXPECTED.legacyBuses ||
          currentLegacy.some(
            (bus) =>
              !originalSet.has(String(bus._id))
          )
        ) {
          throw new Error(
            "Legacy bus records changed. " +
            "Transaction cancelled."
          );
        }

        const countOptions = { session };

        const [
          currentBookings,
          currentLocks,
          currentTrips,
        ] = await Promise.all([
          bookings.countDocuments(
            linkedFilter,
            countOptions
          ),
          seatlocks.countDocuments(
            linkedFilter,
            countOptions
          ),
          trips.countDocuments(
            linkedFilter,
            countOptions
          ),
        ]);

        if (
          currentBookings !== EXPECTED.bookings ||
          currentLocks !== EXPECTED.seatLocks ||
          currentTrips !== 0
        ) {
          throw new Error(
            "Linked records changed. " +
            "Transaction cancelled."
          );
        }

        // Delete only legacy-linked SeatLocks.

        const deletedLocks =
          await seatlocks.deleteMany(
            linkedFilter,
            { session }
          );

        // Delete only legacy-linked Bookings.

        const deletedBookings =
          await bookings.deleteMany(
            linkedFilter,
            { session }
          );

        // Delete only the audited legacy buses.

        const deletedBuses =
          await buses.deleteMany(
            {
              _id: { $in: legacyIds },
              operatorId: null,
            },
            { session }
          );

        // Roll back everything if counts differ.

        if (
          deletedLocks.deletedCount !==
            EXPECTED.seatLocks ||
          deletedBookings.deletedCount !==
            EXPECTED.bookings ||
          deletedBuses.deletedCount !==
            EXPECTED.legacyBuses
        ) {
          throw new Error(
            "Deletion count mismatch. " +
            "Rolling back transaction."
          );
        }
      },
      {
        readConcern: {
          level: "snapshot",
        },
        writeConcern: {
          w: "majority",
        },
      }
    );

    console.log("\nCLEANUP COMMITTED.");
    console.log("Legacy buses deleted: 99");
    console.log("Legacy bookings deleted: 20");
    console.log("Legacy seatlocks deleted: 24");
    console.log("Operator buses not targeted.");
  } finally {
    await session.endSession();
  }
}

main()
  .catch((error) => {
    console.error("\nCLEANUP STOPPED:");
    console.error(error.message);

    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
