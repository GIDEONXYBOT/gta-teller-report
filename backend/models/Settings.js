import mongoose from "mongoose";

const settingsSchema = new mongoose.Schema({
  baseSalary: {
    teller: { type: Number, default: 450 },
    supervisor: { type: Number, default: 600 },
    watcher: { type: Number, default: 500 },
    declarator: { type: Number, default: 600 },
  },
  shiftStartTime: { type: String, default: "09:00" },
  shortPenaltyDivider: { type: Number, default: 3 },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Settings", settingsSchema);
