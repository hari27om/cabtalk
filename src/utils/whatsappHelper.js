import axios from "axios";
import wati_auth from "../config.js";
export const sendWhatsAppMessage = async (phoneNumber, message) => {
  try {
    const response = await axios.post(
      `https://live-mt-server.wati.io/388428/api/v1/sendSessionMessage/${phoneNumber}`,
      {},
      {
        params: { messageText: message },
        headers: {
          Authorization: `Bearer ${wati_auth}`,
          "Content-Type": "application/json",
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error(
      "Error sending WhatsApp message:",
      error.response?.data || error.message
    );
    return null;
  }
};