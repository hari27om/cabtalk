// seedShiftOptions.js
import mongoose from "mongoose";
import ShiftModel from "./models/ShiftModel";

const uri = "mongodb+srv://vivekverma:vivekvermagxi@cab-talk.gus9m.mongodb.net/cabDB"; // replace with your DB name

const shiftData = {
  Morning1: [
    "06:30 am to 03:30 pm",
    "06:30 am to 04:30 pm",
    "06:30 am to 05:30 pm",
    "08:30 am to 04:30 pm",
    "08:30 am to 06:30 pm",
  ],
  Morning2: [
    "09:00 am to 06:00 pm",
    "09:00 am to 08:00 pm",
    "09:30 am to 05:30 pm",
    "09:30 am to 06:30 pm",
    "10:00 am to 07:00 pm",
    "10:30 am to 07:30 pm",
    "10:30 am to 09:30 pm",
    "11:30 am to 08:30 pm",
  ],
  Noon1: [
    "12:00 pm to 09:00 pm",
    "01:00 pm to 10:00 pm",
    "02:00 pm to 11:00 pm",
    "03:00 pm to 12:00 am",
    "03:30 pm to 12:30 am",
    "03:30 pm to 01:30 am",
  ],
  Noon2: [
    "04:00 pm to 01:00 am",
    "04:30 pm to 01:30 am",
    "04:30 pm to 03:00 am",
    "05:00 pm to 01:30 am",
    "05:30 pm to 02:30 am",
  ],
  Evening1: [
    "06:00 pm to 03:00 am",
    "06:30 pm to 03:30 am",
    "06:30 pm to 04:30 am",
    "07:30 pm to 04:30 am",
    "08:30 pm to 05:30 am",
  ],
  Evening2: [
    "09:00 pm to 06:00 am",
    "09:30 pm to 06:30 am",
    "10:00 pm to 07:00 am",
    "10:30 pm to 07:30 am",
    "10:30 pm to 09:30 am",
    "11:00 pm to 10:00 am",
    "11:30 pm to 08:30 am",
  ],
  Night: [
    "01:00 am to 09:30 pm",
    "01:30 am to 10:00 pm",
    "03:30 am to 12:30 pm",
    "04:30 am to 01:30 pm",
  ],
};

async function seedShiftOptions() {
  try {
    await mongoose.connect(uri);
    console.log("MongoDB connected.");

    await ShiftModel.deleteMany();

    const docs = Object.entries(shiftData).map(([name, shifts]) => ({
      name,
      shifts,
    }));

    await ShiftModel.insertMany(docs);

    console.log("Shift options inserted successfully.");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

seedShiftOptions();