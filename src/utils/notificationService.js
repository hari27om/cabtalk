// utils/notificationService.js
import crypto from "crypto";
import Journey from "../models/JourneyModel.js";
import Notification from "../models/Notification.js";
import PassengerLeave from "../models/PassengerLeave.js";
 
function roundUpToNextMinute(date = new Date()) {
  const d = new Date(date);
  if (d.getSeconds() === 0 && d.getMilliseconds() === 0) return d;
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() + 1);
  return d;
}
 
export async function storeJourneyNotifications(journeyId, passengers) {
 
  const journey = await Journey.findById(journeyId).lean();
  if (!journey) {
    console.log(`❌ Journey not found: ${journeyId}`);
    return;
  }
 
  const now = new Date();
 
  const journeyDateRaw = journey.originalStart ? new Date(journey.originalStart) : (journey.createdAt ? new Date(journey.createdAt) : new Date());
  const journeyDate = new Date(journeyDateRaw.getFullYear(), journeyDateRaw.getMonth(), journeyDateRaw.getDate());
 
  const leaves = await PassengerLeave.find({
    assetId: journey.Asset,
    shift: journey.Journey_shift,
    startDate: { $lte: journeyDate },
    endDate: { $gte: journeyDate },
  }).select("passengerId").lean();
  const leaveSet = new Set(leaves.map((l) => String(l.passengerId)));
 
  for (const p of passengers) {
    if (!p || !p.passenger) {
      continue;
    }
 
    const pid = String(p.passenger._id ? p.passenger._id : p.passenger);
    if (!pid) {
      continue;
    }
 
    if (leaveSet.has(pid)) {
      continue;
    }
 
    const triggers = [];
 
    if (p.bufferStart) {
      const bufferStartTime = new Date(p.bufferStart);
      if (bufferStartTime > now) {
        const intendedBefore10 = new Date(bufferStartTime.getTime() - 10 * 60 * 1000);
        let scheduledTime = intendedBefore10 > now ? intendedBefore10 : roundUpToNextMinute(now);
 
        if (scheduledTime < bufferStartTime) {
          triggers.push({
            triggerId: crypto.randomUUID(),
            type: "before10Min",
            intendedTriggerTime: intendedBefore10,
            triggerTime: scheduledTime,
            status: "pending",
          });
        }
      }
    }
 
    if (p.bufferEnd) {
      const bufferEndTime = new Date(p.bufferEnd);
      if (bufferEndTime > now) {
        triggers.push({
          triggerId: crypto.randomUUID(),
          type: "bufferEnd",
          triggerTime: bufferEndTime,
          status: "pending",
        });
      }
    }
 
    if (!triggers.length) {
      continue;
    }
 
    for (const trig of triggers) {
      try {
        await Notification.updateOne(
          { journeyId, passengerId: p.passenger._id },
          {
            $setOnInsert: {
              journeyId,
              passengerId: p.passenger._id,
              phoneNumber: p.passenger.Employee_PhoneNumber,
              name: p.passenger.Employee_Name,
            },
            $push: { triggers: trig },
          },
          { upsert: true }
        );
      } catch (err) {
        if (!(err && err.code === 11000)) {
          throw err;
        } else {
          console.log(`⚠️ Duplicate trigger ignored for passenger ${pid}`);
        }
      }
    }
  }
}
 
export async function cancelPendingNotificationsForPassenger(passengerId, journeyId) {
  const result = await Notification.updateMany(
    { passengerId, journeyId, "triggers.status": { $in: ["pending", "processing"] } },
    { $set: { "triggers.$[].status": "cancelled" } }
  );
}