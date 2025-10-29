import axios from "axios";
import Driver from "../models/driverModel.js";
import Asset from "../models/assetModel.js";
import Journey from "../models/JourneyModel.js";
import Passenger from "../models/Passenger.js";
import { sendWhatsAppMessage } from "../utils/whatsappHelper.js";

// Helper functions
const formatTitle = (name = "", phoneNumber = "") => {
  const MAX = 22;
  const SEP = " 📞";
  let title = `${name}${SEP}${phoneNumber}`;
  const overflow = title.length - MAX;
  if (overflow > 0) {
    const allowedNameLen = Math.max(0, name.length - overflow);
    title = `${name.slice(0, allowedNameLen)}${SEP}${phoneNumber}`;
  }
  return title;
};

const toIdString = (v) => {
  if (!v && v !== 0) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object" && v._id) return String(v._id);
  return String(v);
};

const getBoardedPassengersSet = (journey) => {
  return new Set((journey.boardedPassengers || []).map(bp => 
    bp && bp.passenger ? toIdString(bp.passenger) : toIdString(bp)
  ));
};

export const sendPassengerList = async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    
    if (!phoneNumber) {
      return res.status(400).json({ success: false, message: "Phone number is required." });
    }

    const driver = await Driver.findOne({ phoneNumber }).lean();
    if (!driver) {
      return res.status(404).json({ success: false, message: "Driver not found." });
    }

    const asset = await Asset.findOne({ driver: driver._id }).populate({
      path: "passengers.passengers.passenger",
      model: "Passenger",
      select: "Employee_Name Employee_PhoneNumber Employee_Address",
    }).lean();

    if (!asset) {
      return res.status(404).json({ success: false, message: "No asset assigned to this driver." });
    }

    const journey = await Journey.findOne({ Driver: driver._id }).lean();
    if (!journey) {
      return res.status(500).json({ success: false, message: "Journey record missing." });
    }

    const shiftBlock = (asset.passengers || []).find(b => b.shift === journey.Journey_shift);
    if (!shiftBlock || !Array.isArray(shiftBlock.passengers)) {
      await sendWhatsAppMessage(phoneNumber, "No passengers assigned.");
      return res.json({ success: true, message: "No passengers assigned." });
    }

    const boardedSet = getBoardedPassengersSet(journey);
    const rows = [];

    // Process passengers
    for (const ps of shiftBlock.passengers) {
      if (!ps || !ps.passenger) continue;

      let passengerObj = ps.passenger;
      const passengerId = toIdString(passengerObj);
      
      // Skip if already boarded
      if (boardedSet.has(passengerId)) continue;

      // Load passenger data if not populated
      const isPopulated = typeof passengerObj === "object" && passengerObj.Employee_Name;
      if (!isPopulated) {
        passengerObj = await Passenger.findById(passengerId)
          .select("Employee_Name Employee_PhoneNumber Employee_Address")
          .lean();
        if (!passengerObj) continue;
      }

      const title = formatTitle(passengerObj.Employee_Name, passengerObj.Employee_PhoneNumber);
      const description = (`📍 ${passengerObj.Employee_Address || "Address not available"}`).slice(0, 70);
      rows.push({ title, description });
    }

    if (rows.length === 0) {
      await sendWhatsAppMessage(phoneNumber, "No available passengers to display.");
      return res.json({ success: true, message: "No available passengers to display." });
    }

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

    return res.status(200).json({
      success: true,
      message: "Passenger list sent successfully via WhatsApp.",
      data: response.data,
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