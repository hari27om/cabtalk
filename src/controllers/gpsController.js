import { fetchLiveLocations } from "../utils/gpsService.js";
import OverspeedEvent from "../models/OverspeedEvent.js";

export const getLiveLocations = async (req, res) => {
  try {
    const data = await fetchLiveLocations();

    return res.json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    console.error("Controller error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch live locations",
    });
  }
};

export const getOverspeedEvents = async (req, res) => {
  try {
    const { resolved, vehicleNo } = req.query;

    const filter = {};

    if (resolved !== undefined) {
      filter.resolved = resolved === "true";
    }

    if (vehicleNo) {
      filter.vehicleNo = vehicleNo;
    }

    const data = await OverspeedEvent.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      success: true,
      count: data.length,
      data,
    });
  } catch (err) {
    console.error("GET overspeed error:", err.message);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch overspeed events",
    });
  }
};

export const updateOverspeedEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const { resolved } = req.body;

    if (resolved === undefined) {
      return res.status(400).json({
        success: false,
        message: "`resolved` is required",
      });
    }

    const update = {
      resolved: Boolean(resolved),
      resolvedMode: "manual",
      endTime: resolved ? new Date() : null,
    };

    const data = await OverspeedEvent.findByIdAndUpdate(id, update, {
      new: true,
    });

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    return res.json({
      success: true,
      message: "Updated successfully",
      data,
    });
  } catch (err) {
    console.error("UPDATE overspeed error:", err.message);
    return res.status(500).json({
      success: false,
      message: "Failed to update event",
    });
  }
};