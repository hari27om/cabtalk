// utils/InformPassengerLeave.js
import axios from "axios";
import wati_auth from "../config.js";

const WATI_BASE = "https://live-mt-server.wati.io";
const WATI_TENANT = "388428";


export async function sendPassengerLeaveRecordTemplateBroadcast(phone, templateName, parameters = [], broadcastName) {
  const url = `${WATI_BASE}/${WATI_TENANT}/api/v1/sendTemplateMessage?whatsappNumber=${encodeURIComponent(
    phone
  )}`;

  const body = {
    broadcast_name: broadcastName || `broadcast_${templateName}_${Date.now()}`,
    template_name: templateName,
    parameters: parameters,
  };

  try {
    const res = await axios.post(url, body, {
      headers: {
        "content-type": "application/json-patch+json",
        Authorization: `Bearer ${wati_auth}`,
      },
      timeout: 15000,
    });

    return res.data;
  } catch (err) {
    const providerData = err?.response?.data || null;
    const status = err?.response?.status || null;
    const message = err?.message || "Unknown error from axios";

    console.error("watiBroadcast: failed to send template broadcast", {
      to: phone,
      template: templateName,
      broadcastName: body.broadcast_name,
      status,
      message,
      providerData,
    });

    const error = new Error("WATI broadcast failed");
    error.providerData = providerData;
    error.status = status;
    throw error;
  }
}