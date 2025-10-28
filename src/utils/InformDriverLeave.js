// utils/InformDriverLeave.js
import axios from "axios";

const WATI_BASE = "https://live-mt-server.wati.io";
const WATI_TENANT = "388428";
const WATI_BEARER = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI5MzAwNGExMi04OWZlLTQxN2MtODBiNy0zMTljMjY2ZjliNjUiLCJ1bmlxdWVfbmFtZSI6ImhhcmkudHJpcGF0aGlAZ3hpbmV0d29ya3MuY29tIiwibmFtZWlkIjoiaGFyaS50cmlwYXRoaUBneGluZXR3b3Jrcy5jb20iLCJlbWFpbCI6ImhhcmkudHJpcGF0aGlAZ3hpbmV0d29ya3MuY29tIiwiYXV0aF90aW1lIjoiMDIvMDEvMjAyNSAwODozNDo0MCIsInRlbmFudF9pZCI6IjM4ODQyOCIsImRiX25hbWUiOiJtdC1wcm9kLVRlbmFudHMiLCJodHRwOi8vc2NoZW1hcy5taWNyb3NvZnQuY29tL3dzLzIwMDgvMDYvaWRlbnRpdHkvY2xhaW1zL3JvbGUiOiJBRE1JTklTVFJBVE9SIiwiZXhwIjoyNTM0MDIzMDA4MDAsImlzcyI6IkNsYXJlX0FJIiwiYXVkIjoiQ2xhcmVfQUkifQ.tvRl-g9OGF3kOq6FQ-PPdRtfVrr4BkfxrRKoHc7tbC0";

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
        Authorization: `Bearer ${WATI_BEARER}`,
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