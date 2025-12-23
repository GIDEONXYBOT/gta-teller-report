import mongoose from "mongoose";

const SupervisorReportSchema = new mongoose.Schema(
  {
    supervisorId: { type: String, required: true, index: true },
    supervisorName: { type: String, default: "" },
    dateKey: { type: String, required: true, index: true }, // YYYY-MM-DD
    tellerCount: { type: Number, default: 0 },

    totalCashOnHand: { type: Number, default: "" },
    totalSystemBalance: { type: Number, default: "" },
    totalShort: { type: Number, default: "" },
    totalOver: { type: Number, default: "" },

    d1000: { type: Number, default: "" },
    d500: { type: Number, default: "" },
    d200: { type: Number, default: "" },
    d100: { type: Number, default: "" },
    d50: { type: Number, default: "" },
    d20: { type: Number, default: "" },
    coins: { type: Number, default: "" },

    submitted: { type: Boolean, default: false }, // Supervisor has submitted report
    submittedAt: { type: Date, default: null }, // When the supervisor submitted

    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const SupervisorReport = mongoose.model("SupervisorReport", SupervisorReportSchema);
export default SupervisorReport;
