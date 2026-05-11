// utils/gpsService.js
import axios from "axios";

export const fetchLiveLocations = async () => {
  try {
    const response = await axios.post(
      "https://api.pathsecurex.com/api/GPS/getcurrentlocation",
      { clientid: "8586" },
      {
        headers: {
          "Content-Type": "application/json",
          token: "pajhkewv61abhvetnooxy9087sct12309hto678ghty",
        },
      }
    );

    return response.data?.data || [];
  } catch (error) {
    console.error("GPS API error:", error.message);
    throw error; // important
  }
};