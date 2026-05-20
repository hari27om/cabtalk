// utils/InformDriverLeave.js
import axios from "axios";
import wati_auth from "../config.js";

const WATI_BASE = "https://live-mt-server.wati.io";
const WATI_TENANT = "388428";

export async function sendDriverLeaveRecordTemplateBroadcast(
  phone,
  templateName = "inform_driver_leave_record",
  parameters = [],
  broadcastName
) {
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

    const error = new Error("WATI broadcast failed");
    error.providerData = providerData;
    error.status = status;
    throw error;
  }
}