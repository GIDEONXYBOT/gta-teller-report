import mongoose from "mongoose";

const TellerManagementSchema = new mongoose.Schema({
  tellerId: { type: String, required: true, index: true },
  supervisorId: { type: String, required: true, index: true },
  supervisorName: { type: String, default: "" },
  dateKey: { type: String, required: true, index: true }, // YYYY-MM-DD format for daily tracking
  amount: { type: Number, default: "" }, // original capital
  balanceRemaining: { type: Number, default: "" },
  totalRemitted: { type: Number, default: "" },
  notes: { type: String, default: "" },
  transactions: [
    {
      type: { type: String, enum: ["additional", "remit"], required: true },
      amount: { type: Number, required: true },
      note: { type: String },
      date: { type: Date, default: Date.now },
      userId: { type: String },
    },
  ],
  status: { type: String, enum: ["active", "closed", "archived"], default: "active" },
  createdAt: { type: Date, default: Date.now },
});

const TellerManagementModel = mongoose.model("TellerManagement", TellerManagementSchema);
export default TellerManagementModel;
