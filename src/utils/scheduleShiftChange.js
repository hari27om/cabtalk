import ShiftChange from "../models/ShiftChangeModel.js";
const localISODate = (input, timeZone = "Asia/Kolkata") => {
  try {
    const d = input ? new Date(input) : new Date();
    const dateStr = d.toLocaleDateString("en-CA", { timeZone });
    return dateStr;
  } catch (e) {
    const fallback = new Date().toLocaleDateString("en-CA", { timeZone });
    return fallback;
  }
};
 
const istToUTC = (dateStringOrDate) => {
  const date = new Date(dateStringOrDate);
  const isoStringIST = date.toLocaleString("sv-SE", { timeZone: "Asia/Kolkata" });
  const utcDate = new Date(isoStringIST);
  return utcDate;
};

export const scheduleShiftChangeService = async (shiftChangeData) => {
 
  try {
    const {
      passengerId,
      assetId,
      shift,
      slot,
      vehicleNumber,
      startBuffer,
      endBuffer,
      wfoDays,
      effectiveAt,
      reason,
    } = shiftChangeData;
    const effectiveAtISTDateString = localISODate(effectiveAt); 
    const effectiveAtUTC = istToUTC(effectiveAtISTDateString + "T00:00:00"); 
    const startBufferUTC = istToUTC(startBuffer);
    const endBufferUTC = istToUTC(endBuffer);
 
    const shiftChange = new ShiftChange({
      passengerId,
      assetId,
      slot,
      shift,
      vehicleNumber,
      startBuffer: startBufferUTC,
      endBuffer: endBufferUTC,
      wfoDays,
      effectiveAt: effectiveAtUTC,
      reason,
      status: "scheduled",
    });
    await shiftChange.save();
    return shiftChange;
  } catch (err) {
    throw err;
  }
};