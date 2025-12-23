import mongoose from "mongoose";

const notificationRuleSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, enum: ["betting_threshold", "activity_change", "performance_drop"], required: true },
  threshold: Number,
  condition: { type: String, enum: ["greater_than", "less_than", "equals"] },
  channels: { type: [String], default: ["in_app"] }, // in_app, email, sms
  enabled: { type: Boolean, default: true },
  createdBy: mongoose.Schema.Types.ObjectId,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

export default mongoose.model("NotificationRule", notificationRuleSchema);
