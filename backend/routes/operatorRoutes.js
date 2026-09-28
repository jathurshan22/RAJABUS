const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const Operator =
  require("../models/Operator");

const {
  operatorProtect,
} =
  require("../middleware/operatorAuth");


const router = express.Router();


function generateOperatorToken(
  operator
) {
  return jwt.sign(
    {
      id: operator._id,
      email: operator.email,
      role: "operator",
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d",
    }
  );
}


// ==========================================
// REGISTER OPERATOR
// POST /api/operators/register
// ==========================================

router.post(
  "/register",
  async (req, res) => {
    try {
      const {
        companyName,
        ownerName,
        email,
        phone,
        address,
        password,
      } = req.body;

      if (
        !companyName ||
        !ownerName ||
        !email ||
        !phone ||
        !password
      ) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "Please fill all required fields",
          });
      }

      if (password.length < 6) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "Password must contain at least 6 characters",
          });
      }

      const cleanEmail =
        email
          .trim()
          .toLowerCase();

      const existing =
        await Operator.findOne({
          email: cleanEmail,
        });

      if (existing) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "Operator email already registered",
          });
      }

      const hashedPassword =
        await bcrypt.hash(
          password,
          10
        );

      const operator =
        await Operator.create({
          companyName:
            companyName.trim(),

          ownerName:
            ownerName.trim(),

          email:
            cleanEmail,

          phone:
            phone.trim(),

          address:
            address?.trim() || "",

          password:
            hashedPassword,
        });

      return res
        .status(201)
        .json({
          success: true,

          message:
            "Operator registration successful",

          operator: {
            id:
              operator._id,

            companyName:
              operator.companyName,

            ownerName:
              operator.ownerName,

            email:
              operator.email,

            phone:
              operator.phone,

            status:
              operator.status,
          },
        });

    } catch (error) {
      console.error(
        "Operator registration error:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,
          message:
            "Operator registration failed",
          error:
            error.message,
        });
    }
  }
);


// ==========================================
// LOGIN OPERATOR
// POST /api/operators/login
// ==========================================

router.post(
  "/login",
  async (req, res) => {
    try {
      const {
        email,
        password,
      } = req.body;

      if (!email || !password) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "Email and password are required",
          });
      }

      const operator =
        await Operator.findOne({
          email:
            email
              .trim()
              .toLowerCase(),
        });

      if (!operator) {
        return res
          .status(401)
          .json({
            success: false,
            message:
              "Invalid email or password",
          });
      }

      const matched =
        await bcrypt.compare(
          password,
          operator.password
        );

      if (!matched) {
        return res
          .status(401)
          .json({
            success: false,
            message:
              "Invalid email or password",
          });
      }

      if (
        operator.status !==
        "Active"
      ) {
        return res
          .status(403)
          .json({
            success: false,
            message:
              "Operator account is suspended",
          });
      }

      const token =
        generateOperatorToken(
          operator
        );

      return res.json({
        success: true,

        message:
          "Operator login successful",

        token,

        operator: {
          id:
            operator._id,

          companyName:
            operator.companyName,

          ownerName:
            operator.ownerName,

          email:
            operator.email,

          phone:
            operator.phone,

          address:
            operator.address,

          status:
            operator.status,
        },
      });

    } catch (error) {
      console.error(
        "Operator login error:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,
          message:
            "Operator login failed",
          error:
            error.message,
        });
    }
  }
);


// ==========================================
// OPERATOR PROFILE
// GET /api/operators/profile
// ==========================================

router.get(
  "/profile",
  operatorProtect,
  async (req, res) => {
    return res.json({
      success: true,
      operator:
        req.operator,
    });
  }
);


module.exports = router;