import mongoose from "mongoose";

const PaymentRecordSchema = new mongoose.Schema({
  payrollId: { type: mongoose.Schema.Types.ObjectId, ref: "Payroll" },
  amount: { type: Number, required: true },
  weekNumber: { type: Number, required: true },
  paidAt: { type: Date, default: Date.now },
});

const ShortPaymentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    originPayrollId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payroll",
      required: true,
    },
    totalAmount: { type: Number, required: true }, // Total short amount
    weeklyAmount: { type: Number, required: true }, // Amount to deduct per week
    weeksTotal: { type: Number, required: true }, // Total number of weeks
    weeksPaid: { type: Number, default: 0 }, // Number of weeks already paid
    startDate: { type: Date, required: true }, // When the payment plan starts
    status: {
      type: String,
      enum: ["active", "completed", "cancelled"],
      default: "active",
    },
    payments: [PaymentRecordSchema], // History of each weekly payment
    note: { type: String },
  },
  { timestamps: true }
);

// Index for efficient queries
ShortPaymentSchema.index({ userId: 1, status: 1 });
ShortPaymentSchema.index({ startDate: 1 });

// Virtual field for remaining amount
ShortPaymentSchema.virtual("remainingAmount").get(function () {
  return this.totalAmount - (this.weeksPaid * this.weeklyAmount);
});

// Virtual field for remaining weeks
ShortPaymentSchema.virtual("remainingWeeks").get(function () {
  return this.weeksTotal - this.weeksPaid;
});

// Ensure virtuals are included in JSON
ShortPaymentSchema.set("toJSON", { virtuals: true });
ShortPaymentSchema.set("toObject", { virtuals: true });

export default mongoose.models.ShortPayment ||
  mongoose.model("ShortPayment", ShortPaymentSchema);
