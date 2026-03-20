import axios from "axios";

export const getLiveLocations = async (req, res) => {
  try {
    const response = await axios.post(
      "https://api.pathsecurex.com/api/GPS/getcurrentlocation",
      {
        clientid: "8586",
      },
      {
        headers: {
          "Content-Type": "application/json",
          token: "pajhkewv61abhvetnooxy9087sct12309hto678ghty",
        },
      }
    );

    return res.json(response.data);
  } catch (error) {
    console.error("GPS API error:", error.message);
    return res.status(500).json({ success: false });
  }
};
