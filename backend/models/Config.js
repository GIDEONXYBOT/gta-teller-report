import mongoose from "mongoose";

const configSchema = new mongoose.Schema({
  resetHour: { type: Number, default: 0 }, // 0-23
  resetMinute: { type: Number, default: 0 },
  timezone: { type: String, default: "Asia/Manila" },
  updatedAt: { type: Date, default: Date.now },
});

const Config = mongoose.model("Config", configSchema);
export default Config;
