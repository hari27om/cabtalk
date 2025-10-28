// models/Notification.js
import mongoose from "mongoose";

const triggerSubSchema = new mongoose.Schema(
  {
    triggerId: { type: String, required: true, index: true },
    type: {
      type: String,
      enum: ["before10Min", "bufferEnd"],
      required: true,
    },
    triggerTime: { type: Date, required: true, index: true },
    status: {
      type: String,
      enum: ["pending", "processing", "cancelled", "sent"],
      default: "pending",
      index: true,
    },
    processingAt: { type: Date, default: null }, // when claimed for processing
    processingRun: { type: String, default: null }, // runId that claimed it
    retryCount: { type: Number, default: 0 }, // optional: increment on transient failures
  },
  { _id: false }
);

const notificationSchema = new mongoose.Schema(
  {
    journeyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Journey",
      required: true,
      index: true,
    },
    passengerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Passenger",
      required: true,
      index: true,
    },
    phoneNumber: { type: String, required: true },
    name: { type: String, required: true },
    triggers: { type: [triggerSubSchema], default: [] },
  },
  { timestamps: true }
);
notificationSchema.index(
  { journeyId: 1, passengerId: 1, "triggers.type": 1 },
  { unique: true, partialFilterExpression: { "triggers.type": { $exists: true } } }
);
export default mongoose.model("Notification", notificationSchema);