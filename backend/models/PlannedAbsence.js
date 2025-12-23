import mongoose from "mongoose";

const plannedAbsenceSchema = new mongoose.Schema({
  tellerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  tellerName: { type: String, required: true },
  startDate: { type: String, required: true }, // YYYY-MM-DD format
  endDate: { type: String, required: true },   // YYYY-MM-DD format
  reason: { type: String, default: "Personal" }, // Personal, Sick, Vacation, etc.
  daysOfWeek: [{ type: String }], // ['Monday', 'Tuesday', ...] for recurring weekly absences
  isRecurring: { type: Boolean, default: false }, // If true, repeats weekly
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Index for quick lookups by tellerId and date range
plannedAbsenceSchema.index({ tellerId: 1, startDate: 1, endDate: 1 });
plannedAbsenceSchema.index({ tellerId: 1, updatedAt: -1 });

// Auto-update updatedAt on save
plannedAbsenceSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

const PlannedAbsence = mongoose.model("PlannedAbsence", plannedAbsenceSchema);

export default PlannedAbsence;
