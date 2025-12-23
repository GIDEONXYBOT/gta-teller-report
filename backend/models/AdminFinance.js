import mongoose from "mongoose";

const AdminFinanceSchema = new mongoose.Schema({
  date: { type: Date, default: Date.now },
  expenses: { type: Number, default: 0 },
  commission: { type: Number, default: 0 },
  draw: { type: Number, default: 0 },
  operatorOver: { type: Number, default: 0 },
});

export default mongoose.model("AdminFinance", AdminFinanceSchema);
