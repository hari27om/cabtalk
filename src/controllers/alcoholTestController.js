import Driver from "../models/driverModel.js";
import AlcoholTestResult from "../models/alcoholResultModel.js";

/**
 * POST /api/alcohol-test
 * Body:
 * {
 *   "vehicleNumber": "UP16DC2187",
 *   "alcoholLevel": "0.028"
 * }
 */
export const createAlcoholTestReport = async (req, res) => {
  try {
    const { vehicleNumber, alcoholLevel } = req.body;

    // Validate required fields
    if (!vehicleNumber || alcoholLevel === undefined) {
      return res.status(400).json({
        success: false,
        message: "vehicleNumber and alcoholLevel are required.",
      });
    }

    // Find driver by vehicle number
    const driver = await Driver.findOne({
      vehicleNumber: vehicleNumber.trim().toUpperCase(),
    });

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: "Driver not found for the provided vehicle number.",
      });
    }

    // Convert alcohol level to number
    const parsedAlcoholLevel = Number(alcoholLevel);

    if (Number.isNaN(parsedAlcoholLevel)) {
      return res.status(400).json({
        success: false,
        message: "Invalid alcoholLevel value.",
      });
    }

    // Safe if BAC is 0.030 or below
    const SAFE_LIMIT = 0.03;
    const isSafe = parsedAlcoholLevel <= SAFE_LIMIT;

    // Create report
    const alcoholTestResult = await AlcoholTestResult.create({
      driverId: driver._id,
      alcoholLevel: parsedAlcoholLevel,
      isSafe,
    });

    // Populate driver details for response
    const populatedResult = await AlcoholTestResult.findById(
      alcoholTestResult._id
    ).populate("driverId", "name phoneNumber vehicleNumber");

    // TODO:
    // await sendAdminNotification(populatedResult, driver);
    // await sendDriverNotification(populatedResult, driver);

    return res.status(201).json({
      success: true,
      message: "Alcohol test report created successfully.",
      data: populatedResult,
    });
  } catch (error) {
    console.error("Error creating alcohol test report:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error.",
      error: error.message,
    });
  }
};

/**
 * GET /api/alcohol-test?page=1&pageSize=10
 */
export const getAlcoholTestReports = async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const pageSize = Number(req.query.pageSize) || 10;
    const skip = (page - 1) * pageSize;

    const filter = {};

    // Optional filtering by safe/unsafe status
    if (req.query.isSafe !== undefined) {
      filter.isSafe = req.query.isSafe === "true";
    }

    const totalRecords = await AlcoholTestResult.countDocuments(filter);

    const reports = await AlcoholTestResult.find(filter)
      .populate("driverId", "name phoneNumber vehicleNumber")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize);

    return res.status(200).json({
      success: true,
      data: reports,
      pagination: {
        page,
        pageSize,
        totalRecords,
        totalPages: Math.ceil(totalRecords / pageSize),
      },
    });
  } catch (error) {
    console.error("Error fetching alcohol test reports:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error.",
      error: error.message,
    });
  }
};