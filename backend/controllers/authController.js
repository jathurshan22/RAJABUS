
"use strict";

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const User = require("../models/User");
const Admin = require("../models/Admin");

const {
  getNextSequence
} = require("../models/Counter");

// =====================================================
// JWT TOKEN
// KEEP EXISTING 7-DAY LOGIN SESSION
// =====================================================

const generateToken = (payload) => {
  return jwt.sign(
    payload,
    process.env.JWT_SECRET,
    {
      expiresIn: "7d"
    }
  );
};

// =====================================================
// STANDARD USER RESPONSE
// INCLUDE PERMANENT RAJABUS USER ID
// =====================================================

function publicUser(user) {
  return {
    // MongoDB ID - KEEP FOR BOOKINGS AND AUTH
    id: user._id,

    // Public User ID - RBU0001, RBU0002...
    userCode: user.userCode || null,

    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    createdAt: user.createdAt
  };
}

// =====================================================
// VALIDATE REQUIRED TEXT
// =====================================================

function validText(value) {
  return (
    typeof value === "string" &&
    value.trim().length > 0
  );
}

// =====================================================
// REGISTER USER
// POST /api/auth/register
// =====================================================

const register = async (req, res) => {
  try {

    const {
      fullName,
      email,
      phone,
      password
    } = req.body || {};

    // ---------------------------------------------
    // VALIDATE REQUIRED FIELDS
    // ---------------------------------------------

    if (
      !validText(fullName) ||
      !validText(email) ||
      !validText(phone) ||
      !validText(password)
    ) {
      return res.status(400).json({
        success: false,
        message: "All fields are required"
      });
    }

    const cleanEmail =
      email.trim().toLowerCase();

    // ---------------------------------------------
    // CHECK EXISTING USER
    // ---------------------------------------------

    const existingUser =
      await User.findOne({
        email: cleanEmail
      });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Email already registered"
      });
    }

    // ---------------------------------------------
    // HASH PASSWORD
    // ---------------------------------------------

    const hashedPassword =
      await bcrypt.hash(password, 10);

    // =============================================
    // AUTOMATIC UNIQUE RAJABUS USER ID
    // =============================================

    // MongoDB atomic counter provides
    // distinct sequence numbers.

    const nextNumber =
      await getNextSequence(
        "registeredUser"
      );

    // Example:
    // 1     -> RBU0001
    // 25    -> RBU0025
    // 10000 -> RBU10000

    const userCode =
      `RBU${String(nextNumber).padStart(4, "0")}`;

    // ---------------------------------------------
    // SAVE USER WITH PERMANENT USER CODE
    // ---------------------------------------------

    const user =
      await User.create({

        userCode,

        fullName:
          fullName.trim(),

        email:
          cleanEmail,

        phone:
          phone.trim(),

        password:
          hashedPassword,

        // Existing direct registration
        isVerified: true,

        verificationToken:
          null,

        verificationTokenExpires:
          null

      });

    // ---------------------------------------------
    // REGISTRATION SUCCESS RESPONSE
    // ---------------------------------------------

    return res.status(201).json({

      success: true,

      message:
        "Registration successful. You can now log in.",

      user: publicUser(user)

    });

  } catch (error) {

    console.error(
      "Registration error:",
      error
    );

    // ---------------------------------------------
    // HANDLE DUPLICATE EMAIL / USER CODE
    // ---------------------------------------------

    if (error.code === 11000) {

      if (error.keyPattern?.email) {
        return res.status(400).json({
          success: false,
          message: "Email already registered"
        });
      }

      if (error.keyPattern?.userCode) {
        return res.status(409).json({
          success: false,
          message:
            "User ID conflict. Please try again or contact support."
        });
      }

      return res.status(409).json({
        success: false,
        message:
          "A duplicate registration value was detected"
      });
    }

    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

// =====================================================
// USER LOGIN
// POST /api/auth/login
// =====================================================

const login = async (req, res) => {
  try {

    const {
      email,
      password
    } = req.body || {};

    // ---------------------------------------------
    // VALIDATE
    // ---------------------------------------------

    if (
      !validText(email) ||
      !validText(password)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Email and password are required"
      });
    }

    const cleanEmail =
      email.trim().toLowerCase();

    // ---------------------------------------------
    // FIND USER
    // ---------------------------------------------

    const user =
      await User.findOne({
        email: cleanEmail
      });

    // ---------------------------------------------
    // CHECK PASSWORD
    // ---------------------------------------------

    if (
      !user ||
      !(await bcrypt.compare(
        password,
        user.password
      ))
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid email or password"
      });
    }

    // ---------------------------------------------
    // GENERATE JWT
    // KEEP MONGODB _id FOR EXISTING FEATURES
    // ---------------------------------------------

    const token =
      generateToken({

        id: user._id,

        email: user.email,

        role: "user"

      });

    // ---------------------------------------------
    // LOGIN RESPONSE WITH RBU USER CODE
    // ---------------------------------------------

    return res.status(200).json({

      success: true,

      message:
        "Login successful",

      token,

      user: publicUser(user)

    });

  } catch (error) {

    console.error(
      "Login error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

// =====================================================
// ADMIN LOGIN
// POST /api/auth/admin-login
// =====================================================

const adminLogin = async (req, res) => {
  try {

    const {
      email,
      password
    } = req.body || {};

    if (
      !validText(email) ||
      !validText(password)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Email and password are required"
      });
    }

    const cleanEmail =
      email.trim().toLowerCase();

    // ---------------------------------------------
    // FIND ADMIN
    // ---------------------------------------------

    const admin =
      await Admin.findOne({
        email: cleanEmail
      });

    // ---------------------------------------------
    // VERIFY ADMIN PASSWORD
    // ---------------------------------------------

    if (
      !admin ||
      !(await bcrypt.compare(
        password,
        admin.password
      ))
    ) {
      return res.status(401).json({
        success: false,
        message:
          "Invalid admin credentials"
      });
    }

    // ---------------------------------------------
    // GENERATE ADMIN JWT
    // ---------------------------------------------

    const token =
      generateToken({

        id: admin._id,

        email: admin.email,

        role: "admin"

      });

    return res.status(200).json({

      success: true,

      message:
        "Admin login successful",

      token,

      admin: {
        email: admin.email
      }

    });

  } catch (error) {

    console.error(
      "Admin login error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

// =====================================================
// ADMIN CHANGE PASSWORD
// PUT /api/auth/admin-change-password
// =====================================================

const changeAdminPassword =
  async (req, res) => {

    try {

      const {
        currentPassword,
        newPassword
      } = req.body || {};

      // -------------------------------------------
      // VALIDATION
      // -------------------------------------------

      if (
        !validText(currentPassword) ||
        !validText(newPassword)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Current and new password are required"
        });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message:
            "New password must be at least 6 characters"
        });
      }

      // -------------------------------------------
      // FIND ADMIN
      // -------------------------------------------

      const admin =
        await Admin.findOne({
          email: req.user.email
        });

      if (!admin) {
        return res.status(404).json({
          success: false,
          message:
            "Admin account not found"
        });
      }

      // -------------------------------------------
      // CHECK CURRENT PASSWORD
      // -------------------------------------------

      const isMatch =
        await bcrypt.compare(
          currentPassword,
          admin.password
        );

      if (!isMatch) {
        return res.status(400).json({
          success: false,
          message:
            "Current password is incorrect"
        });
      }

      // -------------------------------------------
      // SAVE NEW ADMIN PASSWORD
      // -------------------------------------------

      admin.password =
        await bcrypt.hash(
          newPassword,
          10
        );

      await admin.save();

      return res.json({
        success: true,
        message:
          "Admin password updated successfully"
      });

    } catch (error) {

      console.error(
        "Admin password change error:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Server error"
      });
    }
  };

// =====================================================
// USER CHANGE PASSWORD
// PUT /api/auth/change-password
// =====================================================

const changePassword =
  async (req, res) => {

    try {

      const {
        email,
        currentPassword,
        newPassword
      } = req.body || {};

      // -------------------------------------------
      // VALIDATION
      // -------------------------------------------

      if (
        !validText(email) ||
        !validText(currentPassword) ||
        !validText(newPassword)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "All fields are required"
        });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message:
            "New password must be at least 6 characters"
        });
      }

      const cleanEmail =
        email.trim().toLowerCase();

      // -------------------------------------------
      // FIND USER
      // -------------------------------------------

      const user =
        await User.findOne({
          email: cleanEmail
        });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found"
        });
      }

      // -------------------------------------------
      // CHECK CURRENT PASSWORD
      // -------------------------------------------

      const isMatch =
        await bcrypt.compare(
          currentPassword,
          user.password
        );

      if (!isMatch) {
        return res.status(400).json({
          success: false,
          message:
            "Current password is incorrect"
        });
      }

      // -------------------------------------------
      // SAVE NEW PASSWORD
      // -------------------------------------------

      user.password =
        await bcrypt.hash(
          newPassword,
          10
        );

      await user.save();

      return res.json({
        success: true,
        message:
          "Password changed successfully"
      });

    } catch (error) {

      console.error(
        "Password change error:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Server error"
      });
    }
  };

// =====================================================
// UPDATE USER PROFILE
// PUT /api/auth/update-profile
// =====================================================

const updateProfile =
  async (req, res) => {

    try {

      const {
        email,
        fullName,
        phone
      } = req.body || {};

      // -------------------------------------------
      // VALIDATE
      // -------------------------------------------

      if (
        !validText(email) ||
        !validText(fullName) ||
        !validText(phone)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "All fields are required"
        });
      }

      const cleanEmail =
        email.trim().toLowerCase();

      // -------------------------------------------
      // UPDATE PROFILE
      // NEVER CHANGE RBU USER CODE
      // -------------------------------------------

      const user =
        await User.findOneAndUpdate(

          {
            email: cleanEmail
          },

          {
            fullName: fullName.trim(),
            phone: phone.trim()
          },

          {
            new: true,
            runValidators: true
          }

        );

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found"
        });
      }

      // -------------------------------------------
      // PROFILE RESPONSE WITH RBU CODE
      // -------------------------------------------

      return res.json({

        success: true,

        message:
          "Profile updated successfully",

        user: publicUser(user)

      });

    } catch (error) {

      console.error(
        "Profile update error:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Server error"
      });
    }
  };

// =====================================================
// KEEP ALL EXISTING EXPORTS
// =====================================================

module.exports = {
  register,
  login,
  adminLogin,
  changeAdminPassword,
  changePassword,
  updateProfile
};
