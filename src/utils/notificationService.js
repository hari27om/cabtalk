import crypto from "crypto";
import Journey from "../models/JourneyModel.js";
import Notification from "../models/Notification.js";
import PassengerLeave from "../models/PassengerLeave.js";

export async function storeJourneyNotifications(journeyId, passengers) {
  console.log(`🔔 Starting notification storage for journey: ${journeyId}, passengers: ${passengers?.length || 0}`);
  
  try {
    const journey = await Journey.findById(journeyId).lean();
    if (!journey) {
      console.log(`❌ Journey not found: ${journeyId}`);
      return;
    }
    console.log(`✅ Journey found: ${journeyId}, asset: ${journey.Asset}, shift: ${journey.Journey_shift}`);

    const now = new Date();
    const journeyDateRaw = journey.originalStart
      ? new Date(journey.originalStart)
      : new Date(journey.createdAt || now);
    const journeyDate = new Date(
      journeyDateRaw.getFullYear(),
      journeyDateRaw.getMonth(),
      journeyDateRaw.getDate()
    );
    console.log(`📅 Processing for journey date: ${journeyDate.toISOString()}`);

    const leaves = await PassengerLeave.find({
      assetId: journey.Asset,
      shift: journey.Journey_shift,
      startDate: { $lte: journeyDate },
      endDate: { $gte: journeyDate },
    })
    .select("passengerId")
    .lean();

    console.log(`📋 Found ${leaves.length} leave records for this asset/shift`);

    const leaveSet = new Set(leaves.map((l) => String(l.passengerId)));
    const bulkOps = [];
    
    let skippedNoPassenger = 0;
    let skippedOnLeave = 0;
    let passengersWithTriggers = 0;
    let totalTriggers = 0;

    for (const p of passengers) {
      if (!p?.passenger) {
        skippedNoPassenger++;
        continue;
      }

      const passenger = p.passenger._id ? p.passenger : p.passenger;
      const pid = String(passenger._id || passenger);
      
      if (!pid) {
        skippedNoPassenger++;
        continue;
      }
      
      if (leaveSet.has(pid)) {
        console.log(`⏸️  Skipping passenger on leave: ${pid}, name: ${passenger.Employee_Name}`);
        skippedOnLeave++;
        continue;
      }

      const triggers = [];
      const data = {
        journeyId,
        passengerId: passenger._id || passenger,
        phoneNumber: passenger.Employee_PhoneNumber,
        name: passenger.Employee_Name,
      };

      console.log(`👤 Processing passenger: ${data.name} (${data.passengerId})`);

      // Buffer Start Trigger
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
            console.log(`   ⏰ Added before10Min trigger for: ${triggerTime.toISOString()}`);
          } else {
            console.log(`   ⏰ Skipping before10Min trigger - would have been in past: ${triggerTime.toISOString()}`);
          }
        } else {
          console.log(`   ⏰ Skipping before10Min trigger - bufferStart in past: ${bufferStart.toISOString()}`);
        }
      } else {
        console.log(`   ⏰ No bufferStart available`);
      }

      // Buffer End Trigger
      if (p.bufferEnd) {
        const bufferEnd = new Date(p.bufferEnd);
        if (bufferEnd > now) {
          triggers.push({
            triggerId: crypto.randomUUID(),
            type: "bufferEnd",
            triggerTime: bufferEnd,
            status: "pending",
          });
          console.log(`   🔚 Added bufferEnd trigger for: ${bufferEnd.toISOString()}`);
        } else {
          console.log(`   🔚 Skipping bufferEnd trigger - in past: ${bufferEnd.toISOString()}`);
        }
      } else {
        console.log(`   🔚 No bufferEnd available`);
      }

      if (!triggers.length) {
        console.log(`   ➕ No triggers created for passenger`);
        continue;
      }

      passengersWithTriggers++;
      totalTriggers += triggers.length;
      
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
      
      console.log(`   ✅ Prepared notification with ${triggers.length} triggers`);
    }

    console.log(`📊 Summary:
      - Total passengers: ${passengers?.length || 0}
      - Skipped (no passenger data): ${skippedNoPassenger}
      - Skipped (on leave): ${skippedOnLeave}
      - Passengers with triggers: ${passengersWithTriggers}
      - Total triggers: ${totalTriggers}
      - Bulk operations: ${bulkOps.length}`);

    if (bulkOps.length > 0) {
      try {
        console.log(`💾 Executing bulk write with ${bulkOps.length} operations...`);
        const result = await Notification.bulkWrite(bulkOps, { ordered: false });
        console.log(`✅ Notifications stored successfully:
          - Upserted: ${result.upsertedCount}
          - Modified: ${result.modifiedCount}
          - Matched: ${result.matchedCount}`);
      } catch (err) {
        console.error(`❌ Notification bulkWrite error:`, {
          message: err.message,
          code: err.code,
          bulkOpsCount: bulkOps.length,
          journeyId,
          stack: err.stack
        });
        
        // Log first few failed operations for debugging
        if (err.writeErrors && err.writeErrors.length > 0) {
          console.error(`📝 First 3 write errors:`, err.writeErrors.slice(0, 3));
        }
      }
    } else {
      console.log(`ℹ️  No bulk operations to execute`);
    }

  } catch (error) {
    console.error(`💥 Critical error in storeJourneyNotifications:`, {
      message: error.message,
      stack: error.stack,
      journeyId,
      passengerCount: passengers?.length
    });
  }
}

export async function cancelPendingNotificationsForPassenger(passengerId, journeyId) {
  console.log(`🚫 Cancelling notifications for passenger: ${passengerId}, journey: ${journeyId}`);
  
  try {
    const result = await Notification.updateMany(
      { passengerId, journeyId, "triggers.status": { $in: ["pending", "processing"] } },
      { $set: { "triggers.$[].status": "cancelled" } }
    );
    
    console.log(`✅ Notifications cancelled:`, {
      passengerId,
      journeyId,
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount
    });
    
    return result;
  } catch (error) {
    console.error(`❌ Error cancelling notifications:`, {
      message: error.message,
      stack: error.stack,
      passengerId,
      journeyId
    });
    throw error;
  }
}