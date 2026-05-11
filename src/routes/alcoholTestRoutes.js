import express from "express";
import {
  createAlcoholTestReport,
  getAlcoholTestReports,
} from "../controllers/alcoholTestController.js";

const router = express.Router();

// Create a new alcohol test report (called by WATI webhook)
router.post("/add", createAlcoholTestReport);

// Get all alcohol test reports for dashboard
router.get("/get", getAlcoholTestReports);

export default router;