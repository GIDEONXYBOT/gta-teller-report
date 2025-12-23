import mongoose from "mongoose";

const TellerSessionSchema = new mongoose.Schema({
  supervisorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  tellerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  tellerName: { type: String, required: true },
  capital: { type: Number, default: 0 },
  additional: { type: Number, default: 0 },
  remittance: { type: Number, default: 0 },
  date: { type: Date, default: Date.now },
});

export default mongoose.model("TellerSession", TellerSessionSchema);
