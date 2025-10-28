// controllers/journeyController.js
import Journey from "../models/JourneyModel.js";
import Asset from "../models/assetModel.js";
import Driver from "../models/driverModel.js";
import Passenger from "../models/Passenger.js";
import PassengerLeave from "../models/PassengerLeave.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { sendWhatsAppMessage } from "../utils/whatsappHelper.js";
import { sendPickupConfirmationMessage } from "../utils/PickUpPassengerSendTem.js";
import { sendOtherPassengerSameShiftUpdateMessage } from "../utils/InformOtherPassenger.js";
import { sendDropConfirmationMessage } from "../utils/dropConfirmationMsg.js";
import { startRideUpdatePassengerController } from "../utils/rideStartUpdatePassenger.js";
import { storeJourneyNotifications } from "../utils/notificationService.js";
import { isScheduledToday } from "../utils/weekoffPassengerHelper.js";
 
export const createJourney = asyncHandler(async (req, res) => {
  const { Journey_Type, vehicleNumber, Journey_shift } = req.body;
  if (!Journey_Type || !vehicleNumber || !Journey_shift) {
    return res.status(400).json({
      message: "Journey_Type, vehicleNumber and Journey_shift are required.",
    });
  }
 
  console.log(`[createJourney] Looking up driver for vehicleNumber=${vehicleNumber}`);
  const driver = await Driver.findOne({ vehicleNumber });
  if (!driver) {
    console.log(`[createJourney] No driver found for vehicleNumber=${vehicleNumber}`);
    return res
      .status(404)
      .json({ message: "No driver found with this vehicle number." });
  }
  console.log(`[createJourney] Found driver: ${driver._id} ${driver.name || ""}`);
  const asset = await Asset.findOne({ driver: driver._id }).populate({
    path: "passengers.passengers.passenger",
    model: "Passenger",
    select: "Employee_ID Employee_Name Employee_PhoneNumber wfoDays",
  });
 
  if (!asset) {
    return res
      .status(404)
      .json({ message: "No assigned vehicle found for this driver." });
  }
 
  const existingJourney = await Journey.findOne({ Driver: driver._id });
  if (existingJourney) {
    await sendWhatsAppMessage(
      driver.phoneNumber,
      "Please end this current ride before starting a new one."
    );
    return res.status(400).json({
      message:
        "Active journey exists. Please end the current ride before starting a new one.",
    });
  }
 
  console.log("[createJourney] Creating new journey document");
  const newJourney = new Journey({
    Driver: driver._id,
    Asset: asset._id,
    Journey_Type,
    Journey_shift,
    Occupancy: 0,
    SOS_Status: false,
  });
 
  await newJourney.save();
  console.log(`[createJourney] Journey saved: ${newJourney._id}`);
 
  asset.isActive = true;
  await asset.save();
 
  if (Journey_Type.toLowerCase() === "pickup") {
    console.log("[createJourney] Journey is pickup - preparing passengers and notifications");
    const passengersForShift = [];
    for (const shift of asset.passengers) {
      if (shift.shift !== Journey_shift) continue;
 
      for (const sp of shift.passengers) {
        const passenger = sp.passenger;
        if (!passenger) continue;
 
        const effectiveWfoDays =
          Array.isArray(sp.wfoDays) && sp.wfoDays.length
            ? sp.wfoDays
            : passenger.wfoDays;
 
        if (isScheduledToday(effectiveWfoDays)) {
          passengersForShift.push(sp);
        }
      }
    }
    console.log(`[createJourney] Passengers scheduled for shift ${Journey_shift}: ${passengersForShift.length}`);
 
    const journeyDateRaw = newJourney.originalStart
      ? new Date(newJourney.originalStart)
      : new Date();
    const journeyDate = new Date(
      journeyDateRaw.getFullYear(),
      journeyDateRaw.getMonth(),
      journeyDateRaw.getDate()
    );
 
    const leaves = await PassengerLeave.find({
      assetId: asset._id,
      shift: Journey_shift,
      startDate: { $lte: journeyDate },
      endDate: { $gte: journeyDate },
    })
      .select("passengerId")
      .lean();

    const leaveSet = new Set(leaves.map((l) => String(l.passengerId)));
 
    const filteredPassengersForShift = passengersForShift.filter((ps) => {
      const pid =
        ps && ps.passenger
          ? String(ps.passenger._id ? ps.passenger._id : ps.passenger)
          : null;
      return pid && !leaveSet.has(pid);
    });
 
    try {
      console.log("[createJourney] Calling storeJourneyNotifications");
      await storeJourneyNotifications(
        newJourney._id,
        filteredPassengersForShift
      );
      console.log("[createJourney] storeJourneyNotifications completed");
    } catch (err) {
      console.error("Failed to store journey notifications:", err);
    }
 
    try {
      await startRideUpdatePassengerController(
        { body: { vehicleNumber, Journey_shift } },
        { status: () => ({ json: () => {} }) }
      );
    } catch (err) {
    }
  }
 
  const io = req.app.get("io");
  if (io) {
    io.emit("newJourney", newJourney);
  } else {
  }
  return res.status(201).json({
    message: "Journey created successfully.",
    newJourney,
    updatedAsset: asset,
  });
});
 
export const getJourneys = async (req, res) => {
  try {
    const journeys = await Journey.find()
      .populate({ path: "Driver", model: "Driver" })
      .populate({
        path: "Asset",
        model: "Asset",
        populate: {
          path: "passengers.passengers.passenger",
          model: "Passenger",
        },
      })
      .populate({
        path: "boardedPassengers.passenger",
        model: "Passenger",
      })
      .populate({
        path: "previousJourney",
        model: "EndJourney",
      })
      .populate({
        path: "triggeredBySOS",
        model: "SOS",
      });
 
    return res.status(200).json(journeys);
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};
 
export const handleWatiWebhook = asyncHandler(async (req, res) => {
  res.sendStatus(200);
 
  try {
    if (req.body.text != null) {
      return;
    }
 
    const { id: eventId, type, waId, listReply } = req.body;
 
    if (
      type !== "interactive" ||
      !listReply?.title ||
      !/\d{12}$/.test(listReply.title)
    ) {
      return;
    }
 
    const passengerPhone = listReply.title.match(/(\d{12})$/)[0];
    console.log(`[handleWatiWebhook] Passenger phone extracted: ${passengerPhone}`);
 
    const driver = await Driver.findOne({ phoneNumber: waId });
    if (!driver) {
      console.log(`[handleWatiWebhook] Driver not found for waId=${waId}`);
      return;
    }
    console.log(`[handleWatiWebhook] Driver found: ${driver._id}`);
 
    const journey = await Journey.findOne({ Driver: driver._id })
      .populate({
        path: "Asset",
        select: "passengers capacity",
        populate: {
          path: "passengers.passengers.passenger",
          model: "Passenger",
          select: "Employee_Name Employee_PhoneNumber wfoDays",
        },
      })
      .populate(
        "boardedPassengers.passenger",
        "Employee_Name Employee_PhoneNumber"
      );
 
    if (!journey) {
      console.log(`[handleWatiWebhook] No active journey found for driver ${driver._id}`);
      return;
    }
    console.log(`[handleWatiWebhook] Journey found: ${journey._id}`);
 
    journey.processedWebhookEvents = journey.processedWebhookEvents || [];
    if (journey.processedWebhookEvents.includes(eventId)) {
      console.log(`[handleWatiWebhook] Event ${eventId} already processed, ignoring`);
      return;
    }
 
    const passenger = await Passenger.findOne({
      Employee_PhoneNumber: passengerPhone,
    });
    if (!passenger) {
      console.log(`[handleWatiWebhook] Passenger not found for phone ${passengerPhone}`);
      await sendWhatsAppMessage(
        waId,
        "🚫 Passenger not found. Please verify and retry."
      );
      return;
    }
 
    const thisShift = journey.Asset.passengers.find((shift) =>
      shift.passengers.some((s) => {
        const pid = s.passenger?._id
          ? String(s.passenger._id)
          : String(s.passenger);
        return pid === String(passenger._id);
      })
    );
 
    if (!thisShift) {
      await sendWhatsAppMessage(
        waId,
        "🚫 Passenger not assigned to this vehicle today."
      );
      return;
    }
 
    const passengerOnLeave = await PassengerLeave.findOne({
      passengerId: passenger._id,
      assetId: journey.Asset._id,
      shift: journey.Journey_shift,
      startDate: {
        $lte: journey.originalStart
          ? new Date(journey.originalStart)
          : new Date(),
      },
      endDate: {
        $gte: journey.originalStart
          ? new Date(journey.originalStart)
          : new Date(),
      },
    });
 
    if (passengerOnLeave) {
      await sendWhatsAppMessage(
        waId,
        "🚫 Passenger is on leave for this shift/day."
      );
      return;
    }
 
    if (journey.Occupancy + 1 > journey.Asset.capacity) {
      await sendWhatsAppMessage(
        waId,
        "⚠️ Cannot board. Vehicle at full capacity."
      );
      return;
    }
 
    const cleanedPhone = passengerPhone.replace(/\D/g, "");
    const alreadyBoarded = journey.boardedPassengers.some((bp) => {
      const bpPhone = (bp.passenger.Employee_PhoneNumber || "").replace(
        /\D/g,
        ""
      );
      return bpPhone === cleanedPhone;
    });
 
    if (alreadyBoarded) {
      await sendWhatsAppMessage(waId, "✅ Passenger already boarded.");
      return;
    }
    journey.Occupancy += 1;
    journey.boardedPassengers.push({
      passenger: passenger._id,
      boardedAt: new Date(),
    });
    journey.processedWebhookEvents.push(eventId);
    await journey.save();
 
    if (req.app.get("io")) {
      req.app.get("io").emit("journeyUpdated", journey);
    }
 
    try {
      await sendWhatsAppMessage(waId, "✅ Passenger confirmed. Thank you!");
    } catch (err) {
      console.error("[handleWatiWebhook] Failed sending confirmation to driver:", err);
    }
 
    const jt = (journey.Journey_Type || "").toLowerCase();
    const boardingEntry = thisShift.passengers.find((s) => {
      const pid = s.passenger?._id
        ? String(s.passenger._id)
        : String(s.passenger);
      return pid === String(passenger._id);
    });
 
    const boardingEffectiveWfoDays =
      boardingEntry &&
      Array.isArray(boardingEntry.wfoDays) &&
      boardingEntry.wfoDays.length
        ? boardingEntry.wfoDays
        : passenger.wfoDays;
 
    const journeyDateRaw = journey.originalStart ? new Date(journey.originalStart) : new Date();
    const journeyDate = new Date(journeyDateRaw.getFullYear(), journeyDateRaw.getMonth(), journeyDateRaw.getDate());
 
    const leaves = await PassengerLeave.find({
      assetId: journey.Asset._id,
      shift: journey.Journey_shift,
      startDate: { $lte: journeyDate },
      endDate: { $gte: journeyDate },
    }).select("passengerId").lean();
    const leaveSet = new Set(leaves.map((l) => String(l.passengerId)));
 
    if (jt === "pickup") {
      if (isScheduledToday(boardingEffectiveWfoDays)) {
        try {
          await sendPickupConfirmationMessage(
            passenger.Employee_PhoneNumber,
            passenger.Employee_Name
          );
        } catch (err) {
        }
      }
      const boardedSet = new Set(
        journey.boardedPassengers.map((bp) =>
          (bp.passenger.Employee_PhoneNumber || "").replace(/\D/g, "")
        )
      );
      boardedSet.add(cleanedPhone);
 
      for (const shiftPassenger of thisShift.passengers) {
        const pEntry = shiftPassenger;
        const pDoc = pEntry.passenger;
        if (!pDoc?.Employee_PhoneNumber) continue;
 
        const effectiveWfoDays =
          Array.isArray(pEntry.wfoDays) && pEntry.wfoDays.length
            ? pEntry.wfoDays
            : pDoc.wfoDays;
 
        if (!isScheduledToday(effectiveWfoDays)) {
          console.log(
            `⏭️ Skipping notify for ${pDoc.Employee_Name} (not scheduled today)`
          );
          continue;
        }
        const pidStr = String(pDoc._id ? pDoc._id : pDoc);
        if (leaveSet.has(pidStr)) {
          continue;
        }
        const phoneClean = (pDoc.Employee_PhoneNumber || "").replace(/\D/g, "");
        if (!phoneClean || boardedSet.has(phoneClean)) {
          console.log(`⏭️ Skipping notify for ${pDoc.Employee_Name} (no phone or already boarded)`);
          continue;
        }
        try {
          await sendOtherPassengerSameShiftUpdateMessage(
            pDoc.Employee_PhoneNumber,
            pDoc.Employee_Name
          );
          console.log(`[handleWatiWebhook] Notified other passenger: ${pDoc.Employee_Name}`);
        } catch (err) {
          console.error(
            "Failed to notify other passenger",
            pDoc.Employee_PhoneNumber,
            err
          );
        }
      }
    }
    if (jt === "drop") {
      if (isScheduledToday(boardingEffectiveWfoDays)) {
        try {
          await sendDropConfirmationMessage(
            passenger.Employee_PhoneNumber,
            passenger.Employee_Name
          );
        } catch (err) {
          console.error("[handleWatiWebhook] Failed to send drop confirmation:", err);
        }
      }
    }
  } catch (err) {
    console.error("handleWatiWebhook error:", err);
  }
});