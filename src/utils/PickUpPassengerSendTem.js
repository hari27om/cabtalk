import axios from "axios";
import wati_auth from "../config.js";

const WATI_BASE = "https://live-mt-server.wati.io/388428/api/v1";

export async function sendPickupConfirmationMessage(phoneNumber, passengerName) {
  if (!phoneNumber || !passengerName) {
    throw new Error("phoneNumber and passengerName are required");
  }

  const cleanPhone = phoneNumber.replace(/\D/g, ""); 
  if (!/^91\d{10}$/.test(cleanPhone)) {
    throw new Error("Invalid Indian phone number format");
  }

  const [firstRaw] = String(passengerName).trim().split(/\s+/);
  const firstName = firstRaw || passengerName;

  const url = `${WATI_BASE}/sendTemplateMessage?whatsappNumber=${cleanPhone}`;
  const payload = {
    template_name: "picked_up_passenger_update",
    broadcast_name: `picked_up_passenger_update_${Date.now()}`,
    parameters: [
      {
        name: "name",
        value: firstName,
      },
    ],
  };

  try {
    const response = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${wati_auth}`,
        "Content-Type": "application/json-patch+json",
      },
      timeout: 10000,
    });

    return {
      success: true,
      to: cleanPhone,
      data: response.data,
    };
  } catch (err) {
    return {
      success: false,
      error: err.response?.data || err.message,
    };
  }
}