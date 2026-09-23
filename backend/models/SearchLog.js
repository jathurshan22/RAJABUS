const mongoose = require("mongoose");

const searchLogSchema = new mongoose.Schema(
  {
    to: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { timestamps: true }
);

searchLogSchema.index({ to: 1 });

module.exports = mongoose.model("SearchLog", searchLogSchema);
