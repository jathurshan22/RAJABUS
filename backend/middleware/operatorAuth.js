const jwt = require("jsonwebtoken");
const Operator = require("../models/Operator");

const operatorProtect = async (
  req,
  res,
  next
) => {
  try {
    let token = null;

    const authHeader =
      req.headers.authorization;

    if (
      authHeader &&
      authHeader.startsWith("Bearer ")
    ) {
      token =
        authHeader.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message:
          "Operator login required",
      });
    }

    const decoded =
      jwt.verify(
        token,
        process.env.JWT_SECRET
      );

    if (
      decoded.role !== "operator"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Operator access only",
      });
    }

    const operator =
      await Operator.findById(
        decoded.id
      ).select("-password");

    if (!operator) {
      return res.status(401).json({
        success: false,
        message:
          "Operator account not found",
      });
    }

    if (
      operator.status !== "Active"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Operator account is suspended",
      });
    }

    req.operator = operator;

    next();

  } catch (error) {
    return res.status(401).json({
      success: false,
      message:
        "Invalid or expired operator token",
    });
  }
};

module.exports = {
  operatorProtect,
};