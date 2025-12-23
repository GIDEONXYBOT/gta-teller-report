import mongoose from "mongoose";

// 🧾 Adjustment sub-schema (for admin manual add/deduct logs)
const AdjustmentSchema = new mongoose.Schema({
  delta: { type: Number, required: true }, // positive = add, negative = deduct
  reason: { type: String },
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  createdAt: { type: Date, default: Date.now },
});

const SupervisorPayrollSchema = new mongoose.Schema(
  {
    supervisorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    baseSalary: { type: Number, default: 0 },
    totalSalary: { type: Number, default: 0 },
    deduction: { type: Number, default: 0 },
    over: { type: Number, default: 0 },
    short: { type: Number, default: 0 },
    shortPaymentTerms: { type: Number, default: 1 }, // number of weeks to deduct short
    daysPresent: { type: Number, default: 0 },

    // 🟢 Existing approvals
    approved: { type: Boolean, default: false },
    locked: { type: Boolean, default: false },
    approvedAt: { type: Date },
    lockedAt: { type: Date },
    note: { type: String, default: "" },

    // 💰 Withdrawal-related
    withdrawn: { type: Boolean, default: false },
    withdrawnAt: { type: Date },
    withdrawal: { type: Number, default: 0 }, // total withdrawn amount (for reference)

    // 🧾 Admin adjustments (manual add/deduct)
    adjustments: { type: [AdjustmentSchema], default: [] },

    // 📅 Date field for easier daily payroll queries
    date: { type: String }, // YYYY-MM-DD format
  },
  { timestamps: true }
);

export default mongoose.models.SupervisorPayroll ||
  mongoose.model("SupervisorPayroll", SupervisorPayrollSchema);