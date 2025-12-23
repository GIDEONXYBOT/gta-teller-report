import mongoose from "mongoose";

const auditSchema = new mongoose.Schema({
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  actorName: { type: String },
  actionType: { type: String, required: true },
  data: { type: mongoose.Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now },
});

const AuditLog = mongoose.model("AuditLog", auditSchema);
export default AuditLog;
