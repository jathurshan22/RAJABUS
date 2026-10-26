const express = require("express");

const Bus = require("../models/Bus");

const {
  operatorProtect,
} = require("../middleware/operatorAuth");


const {
  SUPPORTED_CAPACITIES,
} = require("../config/busSeatLayouts");


const router = express.Router();




// =====================================================
// ADD NEW BUS
// POST /api/operator-buses
// =====================================================

router.post("/", operatorProtect, async (req, res) => {
  try {
    const busNo = String(req.body.busNo ?? "").trim();
    const regNo = String(req.body.regNo ?? "").trim();
    const type = String(req.body.type ?? "").trim();
    const totalSeats = Number(req.body.totalSeats);

    if (!busNo || !regNo || !["Private", "CTB"].includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Enter valid bus details",
      });
    }

    if (!SUPPORTED_CAPACITIES.includes(totalSeats)) {
      return res.status(400).json({
        success: false,
        message: "Choose 52, 54 or 56 seats",
      });
    }

    const exists = await Bus.exists({ regNo });

    if (exists) {
      return res.status(409).json({
        success: false,
        message: "Registration number already exists",
      });
    }

    const bus = await Bus.create({
      operatorId: req.operator._id,
      busNo,
      regNo,
      type,
      totalSeats,
    });

    return res.status(201).json({
      success: true,
      message: "Bus added successfully",
      bus,
    });

  } catch (error) {
    console.error("Add bus error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to add bus",
    });
  }
});




// =====================================================
// GET LOGGED-IN OPERATOR BUSES
// GET /api/operator-buses
// =====================================================

router.get(
  "/",
  operatorProtect,
  async (req, res) => {
    try {

      const buses =
        await Bus.find({
          operatorId:
            req.operator._id,
        }).sort({
          createdAt: -1,
        });


      return res.json({
        success: true,
        count:
          buses.length,
        buses,
      });

    } catch (error) {

      return res.status(500).json({
        success: false,
        message:
          "Failed to load buses",
        error:
          error.message,
      });
    }
  }
);


// =====================================================
// GET SINGLE OPERATOR BUS
// GET /api/operator-buses/:id
// =====================================================

router.get(
  "/:id",
  operatorProtect,
  async (req, res) => {
    try {

      const bus =
        await Bus.findOne({
          _id:
            req.params.id,

          operatorId:
            req.operator._id,
        });


      if (!bus) {
        return res.status(404).json({
          success: false,
          message:
            "Bus not found",
        });
      }


      return res.json({
        success: true,
        bus,
      });

    } catch (error) {

      return res.status(500).json({
        success: false,
        message:
          "Failed to load bus",
        error:
          error.message,
      });
    }
  }
);




// =====================================================
// UPDATE BUS
// PUT /api/operator-buses/:id
// =====================================================

router.put("/:id", operatorProtect, async (req, res) => {
  try {
    const bus = await Bus.findOne({
      _id: req.params.id,
      operatorId: req.operator._id,
    });

    if (!bus) {
      return res.status(404).json({
        success: false,
        message: "Bus not found",
      });
    }

    const hasCapacity = Object.prototype.hasOwnProperty.call(
      req.body,
      "totalSeats"
    );

    if (hasCapacity) {
      const requested = Number(req.body.totalSeats);
      const previous = Number(bus.totalSeats ?? 54);

      if (!Number.isInteger(requested) || requested <= 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid seat capacity",
        });
      }

      if (requested !== previous) {
        if (!SUPPORTED_CAPACITIES.includes(requested)) {
          return res.status(400).json({
            success: false,
            message: "Choose 52, 54 or 56 seats",
          });
        }

        // Read-only checks protect existing trips/bookings.
        const db = Bus.db;

        const [trip, booking, lock] = await Promise.all([
          db.collection("trips").findOne(
            { busId: bus._id },
            { projection: { _id: 1 } }
          ),
          db.collection("bookings").findOne(
            { busId: bus._id },
            { projection: { _id: 1 } }
          ),
          db.collection("seatlocks").findOne(
            { busId: bus._id },
            { projection: { _id: 1 } }
          ),
        ]);

        if (trip || booking || lock) {
          return res.status(409).json({
            success: false,
            message:
              "Cannot change capacity: this bus already has trip or booking history",
          });
        }

        bus.totalSeats = requested;
      }
    }

    for (const field of ["busNo", "regNo", "type"]) {
      if (req.body[field] !== undefined) {
        bus[field] = String(req.body[field] ?? "").trim();
      }
    }

    if (
      !bus.busNo ||
      !bus.regNo ||
      !["Private", "CTB"].includes(bus.type)
    ) {
      return res.status(400).json({
        success: false,
        message: "Enter valid bus details",
      });
    }

    const duplicate = await Bus.exists({
      regNo: bus.regNo,
      _id: { $ne: bus._id },
    });

    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: "Registration number already exists",
      });
    }

    await bus.save();

    return res.json({
      success: true,
      message: "Bus updated successfully",
      bus,
    });

  } catch (error) {
    console.error("Update bus error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update bus",
    });
  }
});




// =====================================================
// DELETE BUS
// DELETE /api/operator-buses/:id
// =====================================================

router.delete(
  "/:id",
  operatorProtect,
  async (req, res) => {
    try {

      const bus =
        await Bus.findOne({
          _id:
            req.params.id,

          operatorId:
            req.operator._id,
        });


      if (!bus) {
        return res.status(404).json({
          success: false,
          message:
            "Bus not found or you do not own this bus",
        });
      }


      await Bus.findByIdAndDelete(
        bus._id
      );


      return res.json({
        success: true,
        message:
          "Bus deleted successfully",
      });

    } catch (error) {

      return res.status(500).json({
        success: false,
        message:
          "Failed to delete bus",
        error:
          error.message,
      });
    }
  }
);


module.exports = router;