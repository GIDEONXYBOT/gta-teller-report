import mongoose from "mongoose";

const suggestedTellerSchema = new mongoose.Schema({
  dayKey: { type: String, required: true, index: true }, // YYYY-MM-DD
  suggestions: [
    {
      _id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
      name: String,
      username: String,
      contact: String,
      status: String,
      lastWorked: Date,
      skipUntil: Date,
      lastAbsentReason: String,
      weeklyWorkedDays: Number,
      dailyWorkedDays: mongoose.Schema.Types.Mixed, // { Monday: 1, Tuesday: 0, ... }
      dateRange: {
        startDate: String, // YYYY-MM-DD
        endDate: String,   // YYYY-MM-DD
      },
    },
  ],
  dateRange: {
    startDate: String, // YYYY-MM-DD (week start)
    endDate: String,   // YYYY-MM-DD (week end)
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Ensure unique dayKey (one set of suggestions per day)
suggestedTellerSchema.index({ dayKey: 1 }, { unique: true });

// Auto-update updatedAt on save
suggestedTellerSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

const SuggestedTellerAssignment = mongoose.model(
  "SuggestedTellerAssignment",
  suggestedTellerSchema
);

export default SuggestedTellerAssignment;
