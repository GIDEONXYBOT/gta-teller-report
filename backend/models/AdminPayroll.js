import mongoose from "mongoose";

const AdminPayrollSchema = new mongoose.Schema({
  employeeName: { type: String, required: true },
  role: { type: String, enum: ["teller", "supervisor", "admin"], required: true },
  salary: { type: Number, default: 0 },
  over: { type: Number, default: 0 },
  date: { type: Date, default: Date.now },
});

export default mongoose.model("AdminPayroll", AdminPayrollSchema);
