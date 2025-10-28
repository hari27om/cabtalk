import axios from "axios";
import mongoose from "mongoose";
import Driver from "../models/driverModel.js";
import Asset from "../models/assetModel.js";
import Journey from "../models/JourneyModel.js";
import PassengerLeave from "../models/PassengerLeave.js";
import Passenger from "../models/Passenger.js"; // make sure this path is correct
import { sendWhatsAppMessage } from "../utils/whatsappHelper.js";
import { isScheduledToday } from "../utils/weekoffPassengerHelper.js";

function formatTitle(name = "", phoneNumber = "") {
  const MAX = 22;
  const SEP = " 📞";
  let title = `${name}${SEP}${phoneNumber}`;
  const overflow = title.length - MAX;
  if (overflow > 0) {
    // trim from name side only (keep phone intact)
    const allowedNameLen = Math.max(0, name.length - overflow);
    title = `${name.slice(0, allowedNameLen)}${SEP}${phoneNumber}`;
  }
  return title;
}

function toIdString(v) {
  // Accept mongoose ObjectId, string, number
  if (!v && v !== 0) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object" && v._id) return String(v._id);
  return String(v);
}

export const sendPassengerList = async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    console.log(`[sendPassengerList] Received request for phoneNumber: ${phoneNumber}`);
    if (!phoneNumber) {
      console.log(`[sendPassengerList] No phone number provided`);
      return res.status(400).json({ success: false, message: "Phone number is required." });
    }

    const driver = await Driver.findOne({ phoneNumber }).lean();
    console.log(`[sendPassengerList] Found driver: ${driver ? driver.name : "Not found"}`);
    if (!driver) {
      return res.status(404).json({ success: false, message: "Driver not found." });
    }

    // Populate passenger objects inside asset where possible.
    const asset = await Asset.findOne({ driver: driver._id }).populate({
      path: "passengers.passengers.passenger",
      model: "Passenger",
      select: "Employee_Name Employee_PhoneNumber Employee_Address wfoDays",
    }).lean();

    console.log(`[sendPassengerList] Asset assigned: ${asset ? "Yes" : "No"}`);
    if (!asset) {
      return res.status(404).json({ success: false, message: "No asset assigned to this driver." });
    }

    // Journey for driver (latest/active). Keep same query as createJourney if that's what's working for you.
    const journey = await Journey.findOne({ Driver: driver._id }).lean();
    console.log(`[sendPassengerList] Journey found: ${journey ? "Yes" : "No"}`);
    if (!journey) {
      return res.status(500).json({ success: false, message: "Journey record missing." });
    }

    const shiftBlock = (asset.passengers || []).find(b => b.shift === journey.Journey_shift);
    console.log(`[sendPassengerList] Shift block found: ${shiftBlock ? "Yes" : "No"}`);
    if (!shiftBlock || !Array.isArray(shiftBlock.passengers)) {
      console.log(`[sendPassengerList] No passengers assigned for this shift`);
      await sendWhatsAppMessage(phoneNumber, "No passengers assigned.");
      return res.json({ success: true, message: "No passengers assigned." });
    }

    // Normalize journey date to midnight (local server timezone)
    const journeyDateRaw = journey.originalStart ? new Date(journey.originalStart) : new Date();
    const journeyDate = new Date(journeyDateRaw.getFullYear(), journeyDateRaw.getMonth(), journeyDateRaw.getDate());
    console.log(`[sendPassengerList] Journey date: ${journeyDate.toISOString()}`);

    // Find leaves that overlap the journeyDate for this asset and shift
    const leavesForAsset = await PassengerLeave.find({
      assetId: asset._id,
      shift: shiftBlock.shift,
      startDate: { $lte: journeyDate },
      endDate: { $gte: journeyDate },
    }).select("passengerId").lean();
    console.log(`[sendPassengerList] Leaves found for asset: ${leavesForAsset.length}`);
    const leaveIdsSet = new Set(leavesForAsset.map(l => toIdString(l.passengerId)));

    // Prepare boarded set (normalize ids). NOTE: we removed missedPassengers logic as requested.
    const boardedIds = new Set((journey.boardedPassengers || []).map(bp => {
      if (bp && bp.passenger) return toIdString(bp.passenger);
      return toIdString(bp);
    }));
    console.log(`[sendPassengerList] Boarded: ${boardedIds.size}`);

    const debug = [];

    const rows = [];

    // iterate passengers in the shift block
    for (const ps of (shiftBlock.passengers || [])) {
      try {
        if (!ps || !ps.passenger) {
          debug.push({ reason: "no passenger object", raw: ps });
          continue;
        }

        // Ensure we have the full passenger object. If ps.passenger looks like an id (string/objectId),
        // try to load it from Passenger collection.
        let passengerObj = ps.passenger;
        const maybeId = toIdString(passengerObj);
        const isPopulated = typeof passengerObj === "object" && (passengerObj.Employee_Name || passengerObj.Employee_PhoneNumber || passengerObj.wfoDays);

        if (!isPopulated) {
          passengerObj = await Passenger.findById(maybeId).select("Employee_Name Employee_PhoneNumber Employee_Address wfoDays").lean();
          if (!passengerObj) {
            debug.push({ passengerId: maybeId, reason: "passenger not found in DB after populate fallback" });
            continue;
          }
        }

        const pid = toIdString(passengerObj._id || passengerObj);
        const boarded = boardedIds.has(pid);
        const onLeave = leaveIdsSet.has(pid);

        // effective wfoDays — prefer per-assignment wfoDays; fallback to passenger record
        const effectiveWfoDays = (Array.isArray(ps.wfoDays) && ps.wfoDays.length) ? ps.wfoDays : (passengerObj.wfoDays || []);
        const includeToday = isScheduledToday(effectiveWfoDays);

        // decide exclusion (note: no missedPassengers check)
        let excludedReason = null;
        if (onLeave) excludedReason = "on leave";
        else if (!includeToday) excludedReason = "not scheduled today (wfoDays)";
        else if (boarded) excludedReason = "already boarded";

        if (!excludedReason) {
          const title = formatTitle(passengerObj.Employee_Name, passengerObj.Employee_PhoneNumber);
          const description = (`📍 ${passengerObj.Employee_Address || "Address not available"}`).slice(0, 70);
          rows.push({ title, description });

          debug.push({
            passengerId: pid,
            name: passengerObj.Employee_Name,
            phone: passengerObj.Employee_PhoneNumber,
            wfoDays: effectiveWfoDays,
            includeToday,
            boarded,
            onLeave,
            included: true
          });
        } else {
          debug.push({
            passengerId: pid,
            name: passengerObj.Employee_Name,
            phone: passengerObj.Employee_PhoneNumber,
            wfoDays: effectiveWfoDays,
            includeToday,
            boarded,
            onLeave,
            included: false,
            reason: excludedReason
          });
        }
      } catch (innerErr) {
        console.error(`[sendPassengerList] Error processing passenger entry: ${innerErr?.message || innerErr}`);
        debug.push({ reason: "exception while processing passenger", error: innerErr?.message || innerErr, raw: ps });
      }
    }

    console.log(`[sendPassengerList] Passengers included in list: ${rows.length}`);
    console.log(`[sendPassengerList] Debug sample (first 10):`, JSON.stringify(debug.slice(0, 10), null, 2));

    const watiPayload = {
      header: "Ride Details",
      body: `Passenger list (${driver.vehicleNumber || "Unknown Vehicle"}):`,
      footer: "CabTalk",
      buttonText: "Menu",
      sections: [{ title: "Passenger Details", rows }],
    };
    
    const response = await axios.post(
      `https://live-mt-server.wati.io/388428/api/v1/sendInteractiveListMessage?whatsappNumber=${phoneNumber}`,
      watiPayload,
      {
        headers: {
          Authorization: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI5MzAwNGExMi04OWZlLTQxN2MtODBiNy0zMTljMjY2ZjliNjUiLCJ1bmlxdWVfbmFtZSI6ImhhcmkudHJpcGF0aGlAZ3hpbmV0d29ya3MuY29tIiwibmFtZWlkIjoiaGFyaS50cmlwYXRoaUBneGluZXR3b3Jrcy5jb20iLCJlbWFpbCI6ImhhcmkudHJpcGF0aGlAZ3hpbmV0d29ya3MuY29tIiwiYXV0aF90aW1lIjoiMDIvMDEvMjAyNSAwODozNDo0MCIsInRlbmFudF9pZCI6IjM4ODQyOCIsImRiX25hbWUiOiJtdC1wcm9kLVRlbmFudHMiLCJodHRwOi8vc2NoZW1hcy5taWNyb3NvZnQuY29tL3dzLzIwMDgvMDYvaWRlbnRpdHkvY2xhaW1zL3JvbGUiOiJBRE1JTklTVFJBVE9SIiwiZXhwIjoyNTM0MDIzMDA4MDAsImlzcyI6IkNsYXJlX0FJIiwiYXVkIjoiQ2xhcmVfQUkifQ.tvRl-g9OGF3kOq6FQ-PPdRtfVrr4BkfxrRKoHc7tbC0`,
          "Content-Type": "application/json-patch+json",
        },
        timeout: 15000
      }
    );

    console.log(`[sendPassengerList] Passenger list sent successfully`);
    return res.status(200).json({
      success: true,
      message: "Passenger list sent successfully via WhatsApp.",
      data: response.data,
      debug
    });

  } catch (error) {
    console.error(`[sendPassengerList] Error: ${error?.message || error}`);
    return res.status(500).json({
      success: false,
      message: "Internal error",
      error: error?.message || String(error)
    });
  }
};