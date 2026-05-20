import axios from "axios";
import SOS from "../models/sosModel.js";
import Asset from "../models/assetModel.js";
import Passenger from "../models/Passenger.js";
import wati_auth from "../config.js";

export async function sosUpdatePassengers(sosId, newAssetId, roster = []) {
  if (!Array.isArray(roster)) {
    return { success: false, sentTo: [], failedTo: [], error: "Invalid roster" };
  }
  if (roster.length === 0) {
    return { success: true, sentTo: [], failedTo: [] };
  }

  let sos;
  try {
    sos = await SOS.findById(sosId).lean();
  } catch (err) {
    return { success: false, sentTo: [], failedTo: [], error: err.message };
  }
  if (!sos) {
    return { success: false, sentTo: [], failedTo: [], error: "SOS not found" };
  }
  let brokenAsset, newAsset;
  try {
    [brokenAsset, newAsset] = await Promise.all([
      Asset.findById(sos.asset)
           .populate("driver", "name phoneNumber vehicleNumber")
           .lean(),
      Asset.findById(newAssetId)
           .populate("driver", "name phoneNumber vehicleNumber")
           .lean(),
    ]);
  } catch (err) {
    return { success: false, sentTo: [], failedTo: [], error: err.message };
  }
  if (!brokenAsset || !newAsset) {
    return {
      success: false,
      sentTo: [],
      failedTo: [],
      error: "Broken or new asset not found",
    };
  }
  let passengers;
  try {
    passengers = await Passenger.find({ _id: { $in: roster } })
      .select("Employee_Name Employee_PhoneNumber")
      .lean();
  } catch (err) {
    return { success: false, sentTo: [], failedTo: [], error: err.message };
  }

  const receivers = passengers.map((p) => {
    const cleaned = p.Employee_PhoneNumber.replace(/\D/g, "");
    return {
      whatsappNumber: cleaned,
      customParams: [
        { name: "name",               value: p.Employee_Name },
        { name: "cab_number",         value: brokenAsset.driver.vehicleNumber },
        { name: "new_driver_name",    value: newAsset.driver.name },
        { name: "new_driver_contact", value: newAsset.driver.phoneNumber },
        { name: "new_cab_no",         value: newAsset.driver.vehicleNumber },
      ],
    };
  });

  const sentTo = [];
  let failedTo = [];
  try {
    const response = await axios.post(
      "https://live-mt-server.wati.io/388428/api/v1/sendTemplateMessages",
      {
        broadcast_name: `cab_breakdown_update_passengers_${Date.now()}`,
        template_name: "cab_breakdown_update_passengers",
        receivers,
      },
      {
        headers: {
        Authorization:
          `Bearer ${wati_auth}`,
        "Content-Type": "application/json-patch+json",
      },
        timeout: 10000,
      }
    );

    const results = response.data.results || response.data.messages || [];
    results.forEach((r) => {
      if (r.status === "success") sentTo.push(r.to);
      else                         failedTo.push(r.to);
    });
  } catch (err) {
    failedTo = receivers.map((r) => r.whatsappNumber);
    return { success: false, sentTo: [], failedTo, error: err.message };
  }
  return { success: true, sentTo, failedTo };
}