import express from "express";
import { getLiveLocations } from "../controllers/gpsController.js";

const router = express.Router();

router.post("/live-location", getLiveLocations);

export default router;