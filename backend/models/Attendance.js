import mongoose from "mongoose";

const AttendanceSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  tellerId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  tellerName: String,
  supervisorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  supervisorName: String,
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  adminName: String,
  tellerPresent: { type: Boolean, default: false },
  supervisorPresent: { type: Boolean, default: false },
  adminPresent: { type: Boolean, default: true },
  deduction: { type: Number, default: 0 },
  remarks: { type: String, default: "" },
});

export default mongoose.model("Attendance", AttendanceSchema);
