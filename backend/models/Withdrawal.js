import mongoose from "mongoose";

const WithdrawalSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  payrollIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Payroll" }], // referenced payrolls
  amount: { type: Number, required: true }, // amount withdrawn (could be sum of payrolls)
  remaining: { type: Number, default: 0 }, // remaining balance after this withdrawal
  weekRange: { type: String }, // optional: "2025-11-10 - 2025-11-16"
  
  // Approval workflow
  status: { 
    type: String, 
    enum: ["pending", "approved", "rejected"], 
    default: "pending" 
  },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // admin who approved/rejected
  approvedAt: { type: Date },
  rejectionReason: { type: String },
  
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // who initiated
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Withdrawal", WithdrawalSchema);
