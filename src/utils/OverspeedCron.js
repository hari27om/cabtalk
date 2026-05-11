import cron from "node-cron";
import { fetchLiveLocations } from "../utils/gpsService.js";
import OverspeedEvent from "../models/OverspeedEvent.js";
import Asset from "../models/assetModel.js";

const SPEED_LIMIT = 80;
const activeOverspeed = new Map();

let isRunning = false;

const getAssetsMap = async () => {
  const assets = await Asset.find()
    .populate("driver", "name phoneNumber vehicleNumber")
    .lean();

  const map = new Map();

  for (const asset of assets) {
    const vehicleNo = asset.driver?.vehicleNumber;
    if (vehicleNo) {
      map.set(vehicleNo, asset);
    }
  }

  return map;
};

cron.schedule("* * * * *", async () => {
  if (isRunning) return;
  isRunning = true;

  try {
    const [vehicles, assetMap] = await Promise.all([
      fetchLiveLocations(),
      getAssetsMap(),
    ]);

    for (const v of vehicles) {
      const speed = Number(v.speed);
      const vehicleNo = v.vehicleno;
      const location = v.currentlocation;

      if (!vehicleNo) continue;

      const asset = assetMap.get(vehicleNo);
      const driver = asset?.driver;

      if (!asset || asset.isActive !== true) continue;

      // 🚨 Overspeed
      if (speed > SPEED_LIMIT) {
        if (!activeOverspeed.has(vehicleNo)) {
          activeOverspeed.set(vehicleNo, true);

          await OverspeedEvent.create({
            vehicleNo,
            asset: asset?._id || null,

            driverSnapshot: driver
              ? {
                  name: driver.name,
                  phoneNumber: driver.phoneNumber,
                }
              : null,
            speed,
            location,
            startTime: new Date(),
          });

          console.log(`🚨 Overspeed: ${vehicleNo}`);

          // TODO: send alerts here
        }
      } else {
        if (activeOverspeed.has(vehicleNo)) {
          activeOverspeed.delete(vehicleNo);

          await OverspeedEvent.findOneAndUpdate(
            { vehicleNo, resolved: false, resolvedMode: null },
            {
              $set: {
                resolved: true,
                resolvedMode: "auto",
                endTime: new Date(),
              },
            },
            { sort: { createdAt: -1 } }
          );

          console.log(`✅ Normal: ${vehicleNo}`);
        }
      }
    }
  } catch (err) {
    console.error("❌ Overspeed cron error:", err.message);
  } finally {
    isRunning = false;
  }
});