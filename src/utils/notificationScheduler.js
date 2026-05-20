import wati_auth from "../config.js";

// utils/notificationScheduler.js
const WATI_URL = "https://live-mt-server.wati.io/388428/api/v1/sendTemplateMessages";


function buildFirstName(name) {
  return String(name || "").trim().split(/\s+/)[0] || name || "";
}

async function postTemplate(payload) {
  if (!wati_auth) {
    throw new Error('WATI_AUTH  is not configured');
  }

  try {
    const res = await fetch(WATI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json-patch+json",
        Authorization: `Bearer ${wati_auth}`,
      },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    
    if (res.status === 401) {
      throw new Error(`WATI API Authentication Failed: Token may be expired or invalid`);
    }
    
    if (!res.ok) {
      throw new Error(`WATI API ${res.status}: ${text}`);
    }
    return JSON.parse(text || "{}");
  } catch (error) {
    console.error('WATI API Request Failed:', {
      error: error.message,
      payload: payload
    });
    throw error;
  }
}

export async function sendPickupTemplateBefore10Min(phoneNumber, name) {
  const firstName = buildFirstName(name);
  const payload = {
    template_name: "pick_up_passenger_notification_before_10_minutes__",
    broadcast_name: `pick_up_passenger_notification_before_10_minutes__${Date.now()}`,
    receivers: [
      {
        whatsappNumber: phoneNumber,
        customParams: [{ name: "name", value: firstName }],
      },
    ],
  };
  return postTemplate(payload);
}

export async function sendBufferEndTemplate(phoneNumber, name) {
  const firstName = buildFirstName(name);
  const payload = {
    template_name: "update_passenger_move_cab",
    broadcast_name: `update_passenger_move_cab_${Date.now()}`,
    receivers: [
      {
        whatsappNumber: (phoneNumber || "").replace(/\D/g, ""),
        customParams: [{ name: "name", value: firstName }],
      },
    ],
  };
  return postTemplate(payload);
}