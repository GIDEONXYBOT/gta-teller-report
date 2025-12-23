import mongoose from "mongoose";

const tellerReportSchema = new mongoose.Schema(
  {
    tellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    tellerName: {
      type: String,
      required: false,
    },
    supervisorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    supervisorName: {
      type: String,
      required: false,
    },
    systemBalance: {
      type: Number,
      default: 0,
    },
    cashOnHand: {
      type: Number,
      default: 0,
    },
    short: {
      type: Number,
      default: 0,
    },
    shortPaymentTerms: {
      type: Number,
      default: 1, // Default to 1 term (full payment)
    },
    over: {
      type: Number,
      default: 0,
    },
    d1000: { type: Number, default: 0 },
    d500: { type: Number, default: 0 },
    d200: { type: Number, default: 0 },
    d100: { type: Number, default: 0 },
    d50: { type: Number, default: 0 },
    d20: { type: Number, default: 0 },
    coins: { type: Number, default: 0 },

    totalFromDenomination: {
      type: Number,
      default: 0,
    },

    remarks: {
      type: String,
      default: "",
    },

    // Total fields for transactions (for override functionality)
    totalIn: {
      type: Number,
      default: 0,
    },
    totalOut: {
      type: Number,
      default: 0,
    },
    totalRemittance: {
      type: Number,
      default: 0,
    },
    totalShortOver: {
      type: Number,
      default: 0,
    },

    // Admin-set total bet value
    totalBet: {
      type: Number,
      default: 0,
    },

    // Flag to indicate if report was manually overridden
    isOverridden: {
      type: Boolean,
      default: false,
    },

    // Approval and verification status
    isApproved: {
      type: Boolean,
      default: false,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    isPending: {
      type: Boolean,
      default: true,
    },

    // Date field for filtering reports by day
    date: {
      type: String,
      default: () => new Date().toISOString().split('T')[0],
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

// ✅ Auto-calculate totals and over/short before saving
tellerReportSchema.pre("save", function (next) {
  // Compute total denomination amount
  const denomTotal =
    (this.d1000 || 0) * 1000 +
    (this.d500 || 0) * 500 +
    (this.d200 || 0) * 200 +
    (this.d100 || 0) * 100 +
    (this.d50 || 0) * 50 +
    (this.d20 || 0) * 20 +
    (this.coins || 0);

  this.totalFromDenomination = denomTotal;
  this.updatedAt = new Date();

  // Compute over/short automatically if both values exist
  if (this.systemBalance && this.cashOnHand) {
    const diff = this.cashOnHand - this.systemBalance;
    if (diff > 0) {
      this.over = diff;
      this.short = 0;
    } else if (diff < 0) {
      this.short = Math.abs(diff);
      this.over = 0;
    } else {
      this.short = 0;
      this.over = 0;
    }
  }

  next();
});

export default mongoose.model("TellerReport", tellerReportSchema, "tellerreports");
