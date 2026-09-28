const express = require("express");

const Bus = require("../models/Bus");

const {
  operatorProtect,
} = require("../middleware/operatorAuth");

const router = express.Router();


// =====================================================
// ADD NEW BUS
// POST /api/operator-buses
// =====================================================

router.post(
  "/",
  operatorProtect,
  async (req, res) => {
    try {
      const {
        busNo,
        regNo,
        from,
        to,
        type,
        depart,
        arrive,
        distanceKm,
        fareMin,
        fareMax,
      } = req.body;


      if (
        !busNo ||
        !regNo ||
        !from ||
        !to ||
        !type ||
        !depart ||
        !arrive
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Please fill all required bus details",
        });
      }


      // -----------------------------------------------
      // SAME REGISTRATION NUMBER CHECK
      // -----------------------------------------------

      const existingBus =
        await Bus.findOne({
          regNo: regNo.trim(),
        });


      if (existingBus) {
        return res.status(409).json({
          success: false,
          message:
            "A bus with this registration number already exists",
        });
      }


      // -----------------------------------------------
      // CREATE BUS
      // -----------------------------------------------

      const bus =
        await Bus.create({
          operatorId:
            req.operator._id,

          busNo:
            busNo.trim(),

          regNo:
            regNo.trim(),

          from:
            from.trim(),

          to:
            to.trim(),

          type:
            type.trim(),

          depart:
            depart.trim(),

          arrive:
            arrive.trim(),

          distanceKm:
            Number(distanceKm) || 0,

          fareMin:
            Number(fareMin) || 0,

          fareMax:
            Number(fareMax) || 0,
        });


      return res.status(201).json({
        success: true,
        message:
          "Bus added successfully",
        bus,
      });

    } catch (error) {

      console.error(
        "Add operator bus error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to add bus",
        error:
          error.message,
      });
    }
  }
);


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

router.put(
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


      const allowedFields = [
        "busNo",
        "regNo",
        "from",
        "to",
        "type",
        "depart",
        "arrive",
        "distanceKm",
        "fareMin",
        "fareMax",
      ];


      allowedFields.forEach(
        (field) => {

          if (
            req.body[field] !==
            undefined
          ) {

            if (
              [
                "distanceKm",
                "fareMin",
                "fareMax",
              ].includes(field)
            ) {

              bus[field] =
                Number(
                  req.body[field]
                );

            } else {

              bus[field] =
                String(
                  req.body[field]
                ).trim();
            }
          }
        }
      );


      await bus.save();


      return res.json({
        success: true,
        message:
          "Bus updated successfully",
        bus,
      });

    } catch (error) {

      if (
        error.code === 11000
      ) {
        return res.status(409).json({
          success: false,
          message:
            "Registration number already exists",
        });
      }


      return res.status(500).json({
        success: false,
        message:
          "Failed to update bus",
        error:
          error.message,
      });
    }
  }
);


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