import mongoose from "mongoose";

const ShiftSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    assignedRole: {
      type: String,
      enum: ["admin", "supervisor", "supervisor_teller", "teller", "head_watcher", "sub_watcher"],
      required: true,
    },
    roleWorkedAs: {
      type: String,
      enum: ["admin", "supervisor", "supervisor_teller", "teller", "head_watcher", "sub_watcher"],
      required: true,
    },
    date: {
      type: String, // yyyy-MM-dd format
      required: true,
    },
    baseSalaryUsed: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Compound index to ensure one shift per user per day
ShiftSchema.index({ userId: 1, date: 1 }, { unique: true });

export default mongoose.model("Shift", ShiftSchema);
