import mongoose from "mongoose";

const SystemSettingsSchema = new mongoose.Schema({
  // 🧾 Base Salary per Role
  baseSalary: {
    admin: { type: Number, default: 1000 },
    assistantAdmin: { type: Number, default: 600 },
    supervisor: { type: Number, default: 600 },
    declarator: { type: Number, default: 600 },
    watcher: { type: Number, default: 500 },
    head_watcher: { type: Number, default: 500 },
    sub_watcher: { type: Number, default: 300 },
    teller: { type: Number, default: 450 },
  },

  // 🕐 Shift & Penalty Settings
  shiftStartTime: { type: String, default: "09:00" },
  shortPenaltyDivider: { type: Number, default: 3 },

  // 🎨 Theme Settings
  theme: {
    mode: { type: String, enum: ["light", "dark"], default: "light" },
    lightFont: { type: String, default: "#1a1a1a" },
    darkFont: { type: String, default: "#ffffff" },
    lightBg: { type: String, default: "#f3f4f6" },
    darkBg: { type: String, default: "#0f172a" },
  },

  // 🌏 System Timing & Configuration
  resetTime: { type: String, default: "04:00" },
  supervisorResetTime: { type: String, default: "02:00" }, // Time to clear teller-supervisor assignments
  autoResetSupervisorAssignments: { type: Boolean, default: false }, // Enable/disable auto-reset
  timezone: { type: String, default: "Asia/Manila" },
  commissionRate: { type: Number, default: 0.5 },
  allowMultipleReportsPerDay: { type: Boolean, default: false }, // Allow tellers to submit multiple reports per day

  // 🧩 Metadata
  systemName: { type: String, default: "RMI Teller Report System" },
  lastUpdated: { type: Date, default: Date.now },
});

// ✅ Prevent OverwriteModelError
export default mongoose.models.SystemSettings ||
  mongoose.model("SystemSettings", SystemSettingsSchema);
