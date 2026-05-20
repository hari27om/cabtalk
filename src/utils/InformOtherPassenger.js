import wati_auth from "../config.js";

export const sendOtherPassengerSameShiftUpdateMessage = async (
  passengerPhone,
  otherPassengerName
) => {
  const cleanPhone = passengerPhone.replace(/\D/g, "");
  const [otherFirstRaw] = String(otherPassengerName).trim().split(/\s+/);
  const otherFirst = otherFirstRaw || otherPassengerName;

  const url = `https://live-mt-server.wati.io/388428/api/v1/sendTemplateMessage?whatsappNumber=${cleanPhone}`;

  const options = {
    method: "POST",
    headers: {
      "content-type": "application/json-patch+json",
      Authorization:
        `Bearer ${wati_auth}`,
    },
    body: JSON.stringify({
      broadcast_name: `unboarded_passenger_updates_${Date.now()}`,
      template_name: "unboarded_passenger_updates",
      parameters: [{ name: "name", value: otherFirst }],
    }),
  };

  try {
    const response = await fetch(url, options);
    const data = await response.json();
    return { success: true, to: cleanPhone, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
};