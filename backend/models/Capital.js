import mongoose from "mongoose";

const capitalSchema = new mongoose.Schema(
  {
    tellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    supervisorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false, // auto-linked when capital is assigned
    },
    amount: {
      type: Number,
      required: true,
      default: 0,
    },
    totalAdditional: {
      type: Number,
      default: 0,
    },
    totalRemitted: {
      type: Number,
      default: 0,
    },
    balanceRemaining: {
      type: Number,
      default: 0,
    },
    note: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["active", "completed", "closed"],
      default: "active",
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// ✅ Keep balances consistent automatically
capitalSchema.pre("save", function (next) {
  if (this.isModified("amount") || this.isModified("totalAdditional") || this.isModified("totalRemitted")) {
    // Balance = Starting capital + Additional - Remitted
    this.balanceRemaining = (this.amount + this.totalAdditional) - this.totalRemitted;
  }
  this.updatedAt = new Date();
  next();
});

export default mongoose.model("Capital", capitalSchema);
