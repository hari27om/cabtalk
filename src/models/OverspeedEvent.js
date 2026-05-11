import mongoose from "mongoose";

const overspeedEventSchema = new mongoose.Schema(
  {
    vehicleNo: {
      type: String,
      required: true,
      index: true,
    },
    asset: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Asset",
      required: false,
      index: true,
    },
    driverSnapshot: {
      name: String,
      phoneNumber: String,
    },
    speed: {
      type: Number,
      required: true,
    },
    startTime: {
      type: Date,
      required: true,
    },
    endTime: {
      type: Date,
      default: null,
    },
    location: String,
    resolved: {
      type: Boolean,
      default: false,
      index: true,
    },
    resolvedMode: {
      type: String,
      enum: ["Auto", "Manual", null],
      default: null,
      index: true,
    }
  },
  { timestamps: true }
);
export default mongoose.model("OverspeedEvent", overspeedEventSchema);