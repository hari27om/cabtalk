import express from "express";
import {
  getLiveLocations,
  getOverspeedEvents,
  updateOverspeedEvent,
} from "../controllers/gpsController.js";

const router = express.Router();

router.get("/live-location", getLiveLocations);
router.get("/overspeed-events", getOverspeedEvents);
router.patch("/overspeed-events/:id", updateOverspeedEvent);

export default router;