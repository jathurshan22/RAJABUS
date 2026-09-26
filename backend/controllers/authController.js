const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const User = require("../models/User");
const Admin = require("../models/Admin");


// ======================================================
// GENERATE JWT TOKEN
// ======================================================

const generateToken = (payload) => {
  return jwt.sign(
    payload,
    process.env.JWT_SECRET,
    {
      expiresIn: "7d",
    }
  );
};


// ======================================================
// REGISTER USER
// POST /api/auth/register
// ======================================================

const register = async (req, res) => {
  try {
    const {
      fullName,
      email,
      phone,
      password,
    } = req.body;


    // --------------------------------------------------
    // VALIDATION
    // --------------------------------------------------

    if (
      !fullName ||
      !email ||
      !phone ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }


    const cleanEmail =
      email
        .trim()
        .toLowerCase();


    // --------------------------------------------------
    // CHECK EXISTING USER
    // --------------------------------------------------

    const existingUser =
      await User.findOne({
        email: cleanEmail,
      });


    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Email already registered",
      });
    }


    // --------------------------------------------------
    // HASH PASSWORD
    // --------------------------------------------------

    const hashedPassword =
      await bcrypt.hash(
        password,
        10
      );


    // --------------------------------------------------
    // SAVE USER DIRECTLY
    // NO EMAIL VERIFICATION
    // --------------------------------------------------

    const user =
      await User.create({
        fullName:
          fullName.trim(),

        email:
          cleanEmail,

        phone:
          phone.trim(),

        password:
          hashedPassword,

        // Directly activated
        isVerified: true,

        verificationToken:
          null,

        verificationTokenExpires:
          null,
      });


    // --------------------------------------------------
    // RESPONSE
    // --------------------------------------------------

    return res.status(201).json({
      success: true,

      message:
        "Registration successful. You can now log in.",

      user: {
        id:
          user._id,

        fullName:
          user.fullName,

        email:
          user.email,

        phone:
          user.phone,

        createdAt:
          user.createdAt,
      },
    });

  } catch (error) {

    console.error(
      "Registration error:",
      error
    );


    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};


// ======================================================
// USER LOGIN
// POST /api/auth/login
// ======================================================

const login = async (req, res) => {
  try {
    const {
      email,
      password,
    } = req.body;


    // --------------------------------------------------
    // VALIDATION
    // --------------------------------------------------

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message:
          "Email and password are required",
      });
    }


    const cleanEmail =
      email
        .trim()
        .toLowerCase();


    // --------------------------------------------------
    // FIND USER
    // --------------------------------------------------

    const user =
      await User.findOne({
        email: cleanEmail,
      });


    if (!user) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid email or password",
      });
    }


    // --------------------------------------------------
    // CHECK PASSWORD
    // --------------------------------------------------

    const isMatch =
      await bcrypt.compare(
        password,
        user.password
      );


    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid email or password",
      });
    }


    // --------------------------------------------------
    // NO EMAIL VERIFICATION CHECK
    // --------------------------------------------------


    // --------------------------------------------------
    // GENERATE JWT
    // --------------------------------------------------

    const token =
      generateToken({
        id:
          user._id,

        email:
          user.email,

        role:
          "user",
      });


    // --------------------------------------------------
    // RESPONSE
    // --------------------------------------------------

    return res.status(200).json({
      success: true,

      message:
        "Login successful",

      token,

      user: {
        id:
          user._id,

        fullName:
          user.fullName,

        email:
          user.email,

        phone:
          user.phone,

        createdAt:
          user.createdAt,
      },
    });

  } catch (error) {

    console.error(
      "Login error:",
      error
    );


    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};


// ======================================================
// ADMIN LOGIN
// POST /api/auth/admin-login
// ======================================================

const adminLogin = async (req, res) => {
  try {
    const {
      email,
      password,
    } = req.body;


    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message:
          "Email and password are required",
      });
    }


    const cleanEmail =
      email
        .trim()
        .toLowerCase();


    // --------------------------------------------------
    // FIND ADMIN
    // --------------------------------------------------

    const admin =
      await Admin.findOne({
        email:
          cleanEmail,
      });


    if (!admin) {
      return res.status(401).json({
        success: false,
        message:
          "Invalid admin credentials",
      });
    }


    // --------------------------------------------------
    // CHECK PASSWORD
    // --------------------------------------------------

    const isMatch =
      await bcrypt.compare(
        password,
        admin.password
      );


    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message:
          "Invalid admin credentials",
      });
    }


    // --------------------------------------------------
    // GENERATE ADMIN JWT
    // --------------------------------------------------

    const token =
      generateToken({
        id:
          admin._id,

        email:
          admin.email,

        role:
          "admin",
      });


    return res.status(200).json({
      success: true,

      message:
        "Admin login successful",

      token,

      admin: {
        email:
          admin.email,
      },
    });

  } catch (error) {

    console.error(
      "Admin login error:",
      error
    );


    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};


// ======================================================
// ADMIN CHANGE PASSWORD
// ======================================================

const changeAdminPassword =
  async (req, res) => {

    try {

      const {
        currentPassword,
        newPassword,
      } = req.body;


      if (
        !currentPassword ||
        !newPassword
      ) {
        return res.status(400).json({
          success: false,

          message:
            "Current and new password are required",
        });
      }


      if (
        newPassword.length < 6
      ) {
        return res.status(400).json({
          success: false,

          message:
            "New password must be at least 6 characters",
        });
      }


      // --------------------------------------------------
      // FIND ADMIN
      // --------------------------------------------------

      const admin =
        await Admin.findOne({
          email:
            req.user.email,
        });


      if (!admin) {
        return res.status(404).json({
          success: false,

          message:
            "Admin account not found",
        });
      }


      // --------------------------------------------------
      // CHECK CURRENT PASSWORD
      // --------------------------------------------------

      const isMatch =
        await bcrypt.compare(
          currentPassword,
          admin.password
        );


      if (!isMatch) {
        return res.status(400).json({
          success: false,

          message:
            "Current password is incorrect",
        });
      }


      // --------------------------------------------------
      // HASH NEW PASSWORD
      // --------------------------------------------------

      admin.password =
        await bcrypt.hash(
          newPassword,
          10
        );


      await admin.save();


      return res.json({
        success: true,

        message:
          "Admin password updated successfully",
      });

    } catch (error) {

      console.error(
        "Admin password change error:",
        error
      );


      return res.status(500).json({
        success: false,
        message: "Server error",
        error: error.message,
      });
    }
  };


// ======================================================
// USER CHANGE PASSWORD
// ======================================================

const changePassword =
  async (req, res) => {

    try {

      const {
        email,
        currentPassword,
        newPassword,
      } = req.body;


      if (
        !email ||
        !currentPassword ||
        !newPassword
      ) {
        return res.status(400).json({
          success: false,
          message:
            "All fields are required",
        });
      }


      if (
        newPassword.length < 6
      ) {
        return res.status(400).json({
          success: false,

          message:
            "New password must be at least 6 characters",
        });
      }


      const cleanEmail =
        email
          .trim()
          .toLowerCase();


      // --------------------------------------------------
      // FIND USER
      // --------------------------------------------------

      const user =
        await User.findOne({
          email:
            cleanEmail,
        });


      if (!user) {
        return res.status(404).json({
          success: false,
          message:
            "User not found",
        });
      }


      // --------------------------------------------------
      // CHECK CURRENT PASSWORD
      // --------------------------------------------------

      const match =
        await bcrypt.compare(
          currentPassword,
          user.password
        );


      if (!match) {
        return res.status(400).json({
          success: false,

          message:
            "Current password is incorrect",
        });
      }


      // --------------------------------------------------
      // SAVE NEW PASSWORD
      // --------------------------------------------------

      const hashedPassword =
        await bcrypt.hash(
          newPassword,
          10
        );


      user.password =
        hashedPassword;


      await user.save();


      return res.json({
        success: true,

        message:
          "Password changed successfully",
      });

    } catch (error) {

      console.error(
        "Password change error:",
        error
      );


      return res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };


// ======================================================
// UPDATE USER PROFILE
// ======================================================

const updateProfile =
  async (req, res) => {

    try {

      const {
        email,
        fullName,
        phone,
      } = req.body;


      if (
        !email ||
        !fullName ||
        !phone
      ) {
        return res.status(400).json({
          success: false,

          message:
            "All fields are required",
        });
      }


      const cleanEmail =
        email
          .trim()
          .toLowerCase();


      // --------------------------------------------------
      // UPDATE USER
      // --------------------------------------------------

      const user =
        await User.findOneAndUpdate(
          {
            email:
              cleanEmail,
          },

          {
            fullName:
              fullName.trim(),

            phone:
              phone.trim(),
          },

          {
            new: true,
          }
        );


      if (!user) {
        return res.status(404).json({
          success: false,

          message:
            "User not found",
        });
      }


      return res.json({
        success: true,

        message:
          "Profile updated successfully",

        user: {
          id:
            user._id,

          fullName:
            user.fullName,

          email:
            user.email,

          phone:
            user.phone,

          createdAt:
            user.createdAt,
        },
      });

    } catch (error) {

      console.error(
        "Profile update error:",
        error
      );


      return res.status(500).json({
        success: false,

        message:
          error.message,
      });
    }
  };


// ======================================================
// EXPORTS
// ======================================================

module.exports = {
  register,
  login,
  adminLogin,
  changeAdminPassword,
  changePassword,
  updateProfile,
};