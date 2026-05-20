import wati_auth from "../config.js";

export const sendDropConfirmationMessage = async (phoneNumber, name) => {
  try {
    const cleanedPhone = phoneNumber.replace(/\D/g, "");

    const [firstNameRaw] = name.trim().split(/\s+/);
    const firstName = firstNameRaw || name;

    const url = `https://live-mt-server.wati.io/388428/api/v1/sendTemplateMessage?whatsappNumber=${cleanedPhone}`;

    const options = {
      method: "POST",
      headers: {
        "content-type": "application/json-patch+json",
        Authorization: `Bearer ${wati_auth}`,
      },
      body: JSON.stringify({
        broadcast_name: `drop_confirmation_passenger_final_${Date.now()}`,
        template_name: "drop_confirmation_passenger_final",
        parameters: [
          {
            name: "name",
            value: firstName,
          },
        ],
      }),
    };

    const response = await fetch(url, options);
    const result = await response.json();

    if (response.ok) {
      return { success: true, data: result };
    } else {
      return { success: false, error: result };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
};