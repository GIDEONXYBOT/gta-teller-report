import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema(
  {
    supervisorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false, // auto-linked when supervisor performs action
    },
    tellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: ["starting", "additional", "remittance", "adjustment", "closing", "capital"],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      default: 0,
    },
    balanceBefore: {
      type: Number,
      default: 0,
    },
    balanceAfter: {
      type: Number,
      default: 0,
    },
    note: {
      type: String,
      default: "",
    },
    performedBy: {
      type: String,
      default: "", // supervisor or teller name for reference
    },
    date: {
      type: Date,
      default: Date.now,
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

/* ======================================================
   HOOKS & UTILITIES
   ====================================================== */

// ✅ Auto-update timestamps
transactionSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

// ✅ Automatically compute balanceAfter if before + amount is known
transactionSchema.pre("save", function (next) {
  if (this.isModified("balanceBefore") || this.isModified("amount")) {
    this.balanceAfter = this.balanceBefore + this.amount;
  }
  next();
});

/* ======================================================
   LIVE SOCKET EMITS (Global Notifications)
   ====================================================== */

// Helper to emit safely (works even if no socket server is running)
const safeEmit = (event, data) => {
  try {
    if (global.io) {
      global.io.emit(event, data);
    }
  } catch (err) {
    console.warn("⚠️ Socket emit failed:", err.message);
  }
};

// ✅ After any transaction is saved, broadcast live update
transactionSchema.post("save", function (doc) {
  // Notify dashboards about new or updated transactions
  safeEmit("transactionUpdated", doc);

  // If supervisor involved, update their reports
  if (doc.supervisorId) {
    safeEmit("supervisorReportUpdated", { supervisorId: doc.supervisorId });
  }

  // Always update teller management lists
  if (doc.tellerId) {
    safeEmit("tellerManagementUpdated");
  }
});

// ✅ After any transaction is removed, broadcast update
transactionSchema.post("remove", function (doc) {
  safeEmit("transactionRemoved", doc);
  if (doc.supervisorId)
    safeEmit("supervisorReportUpdated", { supervisorId: doc.supervisorId });
});

/* ======================================================
   STATICS & METHODS (Reporting Helpers)
   ====================================================== */

// ✅ Get transaction summary for a teller
transactionSchema.statics.getTellerSummary = async function (tellerId) {
  const transactions = await this.find({ tellerId }).sort({ date: -1 }).lean();

  const totals = {
    starting: 0,
    additional: 0,
    remittance: 0,
    adjustment: 0,
    closing: 0,
    totalAmount: 0,
  };

  transactions.forEach((t) => {
    totals[t.type] = (totals[t.type] || 0) + t.amount;
    totals.totalAmount += t.amount;
  });

  return { tellerId, transactions, totals };
};

// ✅ Get supervisor summary (all tellers under supervisor)
transactionSchema.statics.getSupervisorSummary = async function (supervisorId) {
  const transactions = await this.find({ supervisorId }).sort({ date: -1 }).lean();

  const groupedByTeller = {};
  transactions.forEach((t) => {
    if (!groupedByTeller[t.tellerId]) groupedByTeller[t.tellerId] = [];
    groupedByTeller[t.tellerId].push(t);
  });

  return groupedByTeller;
};

export default mongoose.model("Transaction", transactionSchema);
