// backend/models/CashflowArchive.js
import mongoose from "mongoose";

const cashflowArchiveSchema = new mongoose.Schema({
  date: { type: Date, default: Date.now },
  overallCapital: { type: Number, default: 0 },
  startingCapital: { type: Number, default: 0 },
  additional: { type: Number, default: 0 },
  remittance: { type: Number, default: 0 },
  revolving: { type: Number, default: 0 },
  cashbox: { type: Number, default: 0 },
  lastUpdated: { type: Date, default: Date.now },
});

export default mongoose.model("CashflowArchive", cashflowArchiveSchema);
