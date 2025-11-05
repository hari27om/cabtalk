import crypto from "crypto";
import Journey from "../models/JourneyModel.js";
import Notification from "../models/Notification.js";
import PassengerLeave from "../models/PassengerLeave.js";

export async function storeJourneyNotifications(journeyId, passengers) {
  const journey = await Journey.findById(journeyId).lean();
  if (!journey) return console.log(`❌ Journey not found: ${journeyId}`);

  const now = new Date();
  const journeyDateRaw = journey.originalStart
    ? new Date(journey.originalStart)
    : new Date(journey.createdAt || now);
  const journeyDate = new Date(
    journeyDateRaw.getFullYear(),
    journeyDateRaw.getMonth(),
    journeyDateRaw.getDate()
  );

  const leaves = await PassengerLeave.find({
    assetId: journey.Asset,
    shift: journey.Journey_shift,
    startDate: { $lte: journeyDate },
    endDate: { $gte: journeyDate },
  })
    .select("passengerId")
    .lean();

  const leaveSet = new Set(leaves.map((l) => String(l.passengerId)));
  const bulkOps = [];

  for (const p of passengers) {
    if (!p?.passenger) continue;

    const passenger = p.passenger._id ? p.passenger : p.passenger;
    const pid = String(passenger._id || passenger);
    if (!pid || leaveSet.has(pid)) continue;

    const triggers = [];
    const data = {
      journeyId,
      passengerId: passenger._id || passenger,
      phoneNumber: passenger.Employee_PhoneNumber,
      name: passenger.Employee_Name,
    };

    if (p.bufferStart) {
      const bufferStart = new Date(p.bufferStart);
      if (bufferStart > now) {
        const triggerTime = new Date(bufferStart.getTime() - 10 * 60 * 1000);
        if (triggerTime > now) {
          triggers.push({
            triggerId: crypto.randomUUID(),
            type: "before10Min",
            triggerTime,
            status: "pending",
          });
        }
      }
    }

    if (p.bufferEnd) {
      const bufferEnd = new Date(p.bufferEnd);
      if (bufferEnd > now) {
        triggers.push({
          triggerId: crypto.randomUUID(),
          type: "bufferEnd",
          triggerTime: bufferEnd,
          status: "pending",
        });
      }
    }

    if (!triggers.length) continue;

    bulkOps.push({
      updateOne: {
        filter: { journeyId: data.journeyId, passengerId: data.passengerId },
        update: {
          $setOnInsert: {
            journeyId: data.journeyId,
            passengerId: data.passengerId,
            phoneNumber: data.phoneNumber,
            name: data.name,
          },
          $addToSet: { triggers: { $each: triggers } },
        },
        upsert: true,
      },
    });
  }

  if (bulkOps.length > 0) {
    try {
      const result = await Notification.bulkWrite(bulkOps, { ordered: false });
      console.log(
        `✅ Notifications stored — Upserted: ${result.upsertedCount}, Modified: ${result.modifiedCount}`
      );
    } catch (err) {
      console.error("❌ Notification storage error:", err);
    }
  }
}

export async function cancelPendingNotificationsForPassenger(passengerId, journeyId) {
  await Notification.updateMany(
    { passengerId, journeyId, "triggers.status": { $in: ["pending", "processing"] } },
    { $set: { "triggers.$[].status": "cancelled" } }
  );
}