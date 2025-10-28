// utils/processShiftChanges.js
import ShiftChange from "../models/ShiftChangeModel.js";
import Passenger from "../models/Passenger.js";
import Asset from "../models/assetModel.js";
 
// Convert a date string or Date in IST to a UTC Date object
const istToUTC = (dateStringOrDate) => {
  const date = new Date(dateStringOrDate);
  const isoStringIST = date.toLocaleString("sv-SE", { timeZone: "Asia/Kolkata" });
  const utcDate = new Date(isoStringIST);
  return utcDate;
};
 
// Get current time in IST and UTC
const getNowISTAndUTC = () => {
  const now = new Date();
  const nowISTString = now.toLocaleString("sv-SE", { timeZone: "Asia/Kolkata" });
  const nowIST = new Date(nowISTString);
  const nowUTC = new Date(nowIST.getTime() - nowIST.getTimezoneOffset() * 60000);
  return { nowIST, nowUTC };
};
 
const processShiftChanges = async () => {
 
  try {
    const { nowIST, nowUTC } = getNowISTAndUTC();
    const scheduledChanges = await ShiftChange.find({
      status: "scheduled",
      effectiveAt: { $lte: nowUTC },
    });
 
    for (const change of scheduledChanges) {
 
      try {
        const passenger = await Passenger.findById(change.passengerId);
        if (!passenger) {
          change.status = "failed";
          change.error = "Passenger not found";
          await change.save();
          continue;
        }
        let asset = null;
        if (change.assetId) {
          asset = await Asset.findById(change.assetId);
        }
 
        if (!asset && change.vehicleNumber) {
          asset = await Asset.findOne({ shortId: change.vehicleNumber });
          if (asset) {
            console.log(`🔄 Asset found by vehicleNumber: ${asset._id}`);
          } else {
            asset = new Asset({
              shortId: change.vehicleNumber,
              driver: null,
              capacity: 4,
              passengers: [],
              isActive: false,
              handlesMultipleShifts: false,
            });
          }
        }
 
        if (!asset) {
          change.status = "failed";
          change.error = "Asset not found";
          await change.save();
          continue;
        }

        if (passenger.asset && String(passenger.asset) !== String(asset._id)) {
          const oldAsset = await Asset.findById(passenger.asset);
          if (oldAsset) {
            oldAsset.passengers = oldAsset.passengers
              .map((shiftGroup) => {
                shiftGroup.passengers = shiftGroup.passengers.filter(
                  (p) => String(p.passenger) !== String(passenger._id)
                );
                return shiftGroup;
              })
              .filter((shiftGroup) => shiftGroup.passengers.length > 0);
            await oldAsset.save();
          } else {
            console.warn(`⚠️ Old asset not found: ${passenger.asset}`);
          }
        }

        passenger.Employee_ShiftTiming = change.shift;
        passenger.asset = asset._id;
        await passenger.save();
        asset.passengers = asset.passengers
          .map((shiftGroup) => {
            shiftGroup.passengers = shiftGroup.passengers.filter(
              (p) => String(p.passenger) !== String(passenger._id)
            );
            return shiftGroup;
          })
          .filter((shiftGroup) => shiftGroup.passengers.length > 0);
 
        const passengerEntry = {
          passenger: passenger._id,
          requiresTransport: true,
          bufferStart: istToUTC(change.startBuffer),
          bufferEnd: istToUTC(change.endBuffer),
          wfoDays: change.wfoDays || [],
        };
 
        let shiftGroup = asset.passengers.find((s) => s.shift === change.shift);
        if (!shiftGroup) {
          asset.passengers.push({ shift: change.shift, passengers: [passengerEntry] });
        } else {
          shiftGroup.passengers.push(passengerEntry);
        }
 
        // STEP 7: Update vehicleNumber if provided
        if (change.vehicleNumber) {
          asset.shortId = change.vehicleNumber;
        }
 
        await asset.save();

        change.status = "applied";
        change.processedAt = new Date();
        change.error = null;
        await change.save();
      } catch (err) {
        change.status = "failed";
        change.error = err.message;
        await change.save();
      }
    }
  } catch (err) {
    console.error("❌ Fatal error in processShiftChanges:", err);
  }
};
 
export default processShiftChanges;
export { processShiftChanges };