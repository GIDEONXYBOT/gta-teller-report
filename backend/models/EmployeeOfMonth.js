import mongoose from "mongoose";

const employeeOfMonthSchema = new mongoose.Schema({
  tellerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  supervisorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  totalBet: { type: Number, default: 0 },
  date: { type: Date, default: Date.now },
  month: { type: String, required: true }, // e.g., "November 2025"
  rank: { type: Number, default: 0 },
  reward: { type: String, default: "" },
});

export default mongoose.model("EmployeeOfMonth", employeeOfMonthSchema);
