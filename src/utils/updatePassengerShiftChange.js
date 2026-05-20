import wati_auth from "../config.js";

// utils/updatePassengerShiftChange.js
const WATI_BASE_URL = "https://live-mt-server.wati.io/388428/api/v1";
 
export async function updatePassengerShiftChange(whatsappNumber, templateName, broadcastName, parameters) {
  const url = `${WATI_BASE_URL}/sendTemplateMessage?whatsappNumber=${whatsappNumber}`;
 
  const options = {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${wati_auth}`,
    },
    body: JSON.stringify({
      template_name: templateName,
      broadcast_name: broadcastName,
      parameters,
    }),
  };
 
  try {
    const res = await fetch(url, options);
    if (!res.ok) throw new Error(`WATI API error: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error("❌ Failed to send WhatsApp message:", err);
    throw err;
  }
}