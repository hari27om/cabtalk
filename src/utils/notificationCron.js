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

  cron.schedule(POLL_CRON, async () => {
    const runId = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
    const now = new Date();

    try {
      const dueNotifications = await Notification.find({
        "triggers.status": "pending",
        "triggers.triggerTime": { $lte: now },
      }).select("_id journeyId passengerId phoneNumber name triggers");

      if (!dueNotifications.length) return;

      const journeyIds = [
        ...new Set(dueNotifications.map((n) => n.journeyId.toString())),
      ];

      const journeys = await Journey.find({ _id: { $in: journeyIds } })
        .populate("Asset Driver", "isActive phoneNumber Employee_Name")
        .lean();

      const journeyMap = new Map();
      journeys.forEach((j) => journeyMap.set(j._id.toString(), j));

      for (const notif of dueNotifications) {
        const { _id: notifId, journeyId, phoneNumber, name, triggers } = notif;
        const journey = journeyMap.get(journeyId.toString());

        const triggersToSend = triggers.filter(
          (t) => t.status === "pending" && new Date(t.triggerTime) <= now
        );

        for (const trigger of triggersToSend) {
          try {
            if (journey?.Asset?.isActive) {
              if (trigger.type === "before10Min") {
                await sendPickupTemplateBefore10Min(phoneNumber, name);
              } else if (trigger.type === "bufferEnd") {
                await sendBufferEndTemplate(phoneNumber, name);
                const driverPhone = journey.Driver?.phoneNumber;
                if (driverPhone) {
                  const msg = `${name} is late for pickup. Please adjust schedule.`;
                  await sendWhatsAppMessage(driverPhone, msg);
                }
              }
              await updateTriggerStatus(notifId, trigger.triggerId, "sent");
            } else {
              await updateTriggerStatus(
                notifId,
                trigger.triggerId,
                "cancelled"
              );
            }
          } catch (err) {
            console.error(`Error in trigger ${trigger.triggerId}:`, err);
            await updateTriggerStatus(notifId, trigger.triggerId, "cancelled");
          }
        }

        await cleanupNotificationIfDone(notifId);
      }
    } catch (err) {
      console.error(`[cron:${runId}] Error:`, err);
    }
  });
}

async function updateTriggerStatus(notifId, triggerId, status) {
  await Notification.updateOne(
    { _id: notifId, "triggers.triggerId": triggerId },
    { $set: { "triggers.$.status": status } }
  );
}

async function cleanupNotificationIfDone(notifId) {
  const hasPending = await Notification.exists({
    _id: notifId,
    "triggers.status": { $in: ["pending", "processing"] },
  });
  if (!hasPending) await Notification.deleteOne({ _id: notifId });
}
