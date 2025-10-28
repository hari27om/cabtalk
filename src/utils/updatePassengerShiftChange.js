// utils/updatePassengerShiftChange.js
const WATI_BASE_URL = "https://live-mt-server.wati.io/388428/api/v1";
 
export async function updatePassengerShiftChange(whatsappNumber, templateName, broadcastName, parameters) {
  const url = `${WATI_BASE_URL}/sendTemplateMessage?whatsappNumber=${whatsappNumber}`;
 
  const options = {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI0YmM2MmFkNC04NTQ3LTRkYzItOTc0Ni0wNmRkMjZiODYzNmMiLCJ1bmlxdWVfbmFtZSI6Im9ta2FyLmphaXN3YWxAZ3hpbmV0d29ya3MuY29tIiwibmFtZWlkIjoib21rYXIuamFpc3dhbEBneGluZXR3b3Jrcy5jb20iLCJlbWFpbCI6Im9ta2FyLmphaXN3YWxAZ3hpbmV0d29ya3MuY29tIiwiYXV0aF90aW1lIjoiMDYvMzAvMjAyNSAwNzozNzoxNSIsInRlbmFudF9pZCI6IjM4ODQyOCIsImRiX25hbWUiOiJtdC1wcm9kLVRlbmFudHMiLCJodHRwOi8vc2NoZW1hcy5taWNyb3NvZnQuY29tL3dzLzIwMDgvMDYvaWRlbnRpdHkvY2xhaW1zL3JvbGUiOiJBRE1JTklTVFJBVE9SIiwiZXhwIjoyNTM0MDIzMDA4MDAsImlzcyI6IkNsYXJlX0FJIiwiYXVkIjoiQ2xhcmVfQUkifQ.dr6x_b4olu0EL6oJcEENiD2nMYrlQx5MWlQTJBttcqg`,
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