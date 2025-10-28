// utils/notificationCron.js
import cron from "node-cron";
import crypto from "crypto";
import Notification from "../models/Notification.js";
import Journey from "../models/JourneyModel.js";
import {
  sendPickupTemplateBefore10Min,
  sendBufferEndTemplate,
} from "../utils/notificationScheduler.js";
import { sendWhatsAppMessage } from "../utils/whatsappHelper.js";
 
const POLL_CRON = "* * * * *";
if (!global.__notificationCronStarted) {
  global.__notificationCronStarted = true;
 
  cron.schedule(
    POLL_CRON,
    async () => {
      const runId = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
 
      try {
        const now = new Date();
 
        const dueNotifications = await Notification.find({
          triggers: {
            $elemMatch: { status: "pending", triggerTime: { $lte: now } },
          },
        })
          .limit(500)
          .select("_id journeyId passengerId phoneNumber name triggers");
 
        const journeyIds = [
          ...new Set(dueNotifications.map((n) => n.journeyId?.toString()).filter(Boolean)),
        ];
 
        const journeys = await Journey.find({ _id: { $in: journeyIds } })
          .select("_id Asset boardedPassengers Journey_Type Driver")
          .populate({ path: "Asset", select: "isActive" })
          .populate({ path: "Driver", select: "phoneNumber Employee_Name" });
 
        const journeyMap = new Map();
        for (const j of journeys) journeyMap.set(j._id.toString(), j);
 
        for (const candidate of dueNotifications) {
          const notifId = candidate._id.toString();
 
          const claimUpdate = {
            $set: {
              "triggers.$[t].status": "processing",
              "triggers.$[t].processingAt": now,
              "triggers.$[t].processingRun": runId,
            },
          };
          const claimOptions = {
            new: true,
            arrayFilters: [{ "t.status": "pending", "t.triggerTime": { $lte: now } },],
          };
 
          const claimed = await Notification.findOneAndUpdate(
            { _id: candidate._id, triggers: { $elemMatch: { status: "pending", triggerTime: { $lte: now } }}},
            claimUpdate,
            claimOptions
          ).lean();
 
          if (!claimed) {
            continue;
          }
 
          const triggersToHandle = (claimed.triggers || []).filter(
            (t) =>
              t.status === "processing" &&
              t.processingRun === runId &&
              new Date(t.triggerTime) <= now
          );
          
          if (!triggersToHandle.length) continue;
 
          const journeyId = claimed.journeyId?.toString() || null;
          const passengerId = claimed.passengerId?.toString() || null;
          const journey = journeyId ? journeyMap.get(journeyId) : null;
 
          if (!journey || !journey.Asset || !journey.Asset.isActive) {
            const triggerIds = triggersToHandle.map((t) => t.triggerId);
            await Notification.updateOne(
              { _id: claimed._id },
              {
                $set: Object.fromEntries(
                  triggerIds.map((id) => [
                    `triggers.$[x${id}].status`,
                    "cancelled",
                  ])
                ),
              },
              { arrayFilters: triggerIds.map((id) => ({
                  [`x${id}.triggerId`]: id,
                })),
              }
            ).catch(() => {});
            const stillPending = await Notification.exists({
              _id: claimed._id,
              "triggers.status": "pending",
            });
            if (!stillPending) {
              await Notification.deleteOne({ _id: claimed._id }).catch(() => {});
            }
            continue;
          }
 
          const boardedIds = new Set(
            (journey.boardedPassengers || []).map((b) => b.passenger.toString())
          );
          const finalStatusMap = new Map();
 
          for (const t of triggersToHandle) {
            try {
              if (passengerId && boardedIds.has(passengerId)) {
                finalStatusMap.set(t.triggerId, "cancelled");
                continue;
              }
 
              if (t.type === "before10Min") {
                await sendPickupTemplateBefore10Min(
                  claimed.phoneNumber,
                  claimed.name
                );
              } else if (t.type === "bufferEnd") {
                await sendBufferEndTemplate(claimed.phoneNumber, claimed.name);
 
                const driverPhone = journey?.Driver?.phoneNumber;
                if (driverPhone) {
                  const driverMsg = `${claimed.name} (${claimed.phoneNumber}) is late for pickup, consider moving the cab.`;
                  await sendWhatsAppMessage(driverPhone, driverMsg).catch(
                    (err) => {
                      console.error(
                        `[cron:${runId}] failed to notify driver ${driverPhone}:`,
                        err && err.stack ? err.stack : err
                      );
                    }
                  );
                }
              } else {
                finalStatusMap.set(t.triggerId, "cancelled");
                continue;
              }
 
              finalStatusMap.set(t.triggerId, "sent");
            } catch (errSend) {
              console.error(
                `[cron:${runId}] send error for notif=${notifId} trigger=${t.triggerId}:`,
                errSend && errSend.stack ? errSend.stack : errSend
              );
              finalStatusMap.set(t.triggerId, "cancelled");
            }
          }
 
          for (const [triggerId, status] of finalStatusMap.entries()) {
            await Notification.updateOne(
              { _id: claimed._id, "triggers.triggerId": triggerId },
              {
                $set: {
                  "triggers.$.status": status,
                  "triggers.$.processingAt": null,
                  "triggers.$.processingRun": null,
                },
              }
            ).catch((err) => {
              console.error(
                `[cron:${runId}] failed to persist status for notif=${notifId} trigger=${triggerId}:`,
                err && err.stack ? err.stack : err
              );
            });
          }
 
          const stillPending = await Notification.exists({
            _id: claimed._id,
            "triggers.status": "pending",
          });
          if (!stillPending) {
            await Notification.deleteOne({ _id: claimed._id }).catch((err) => {
              console.error(
                `[cron:${runId}] failed to delete completed notif ${notifId}:`,
                err && err.stack ? err.stack : err
              );
            });
          }
        } 
      } catch (err) {
        console.error(
          `[cron:${runId}] Notification cron error:`,
          err && err.stack ? err.stack : err
        );
      }
    },
    { scheduled: true }
  );
}