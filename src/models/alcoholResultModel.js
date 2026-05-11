import mongoose from "mongoose";

const alcoholTestResultSchema = new mongoose.Schema(
  {
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Driver",
      required: true,
      index: true,
    },
    alcoholLevel: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
    },
    isSafe: {
      type: Boolean,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

alcoholTestResultSchema.index({ driverId: 1, createdAt: -1 });

export default mongoose.model(
  "AlcoholTestResult",
  alcoholTestResultSchema
);