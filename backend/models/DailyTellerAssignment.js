import mongoose from "mongoose";

const assignmentSchema = new mongoose.Schema({
  dayKey: { type: String, required: true, index: true }, // YYYY-MM-DD
  tellerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  tellerName: { type: String, required: true },
  supervisorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: false }, // Made optional
  supervisorName: { type: String, required: false }, // Made optional
  status: { type: String, enum: ["scheduled", "present", "absent", "replaced"], default: "scheduled" },
  // Indicate the method of assignment (traditional, AI, full-week, manual)
  assignmentMethod: { type: String, default: 'scheduled' },
  // Flag indicating the teller was selected to work the whole week
  isFullWeek: { type: Boolean, default: false },
  absentReason: { type: String, default: "" },
  penaltyDays: { type: Number, default: 0 },
  assignedAt: { type: Date, default: Date.now },
});

assignmentSchema.index({ dayKey: 1, tellerId: 1 }, { unique: true });

const DailyTellerAssignment = mongoose.model("DailyTellerAssignment", assignmentSchema);
export default DailyTellerAssignment;
