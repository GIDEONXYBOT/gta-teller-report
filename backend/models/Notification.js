import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  type: { type: String, enum: ["betting_threshold", "activity_change", "performance_drop", "general"] },
  title: String,
  message: String,
  read: { type: Boolean, default: false },
  channels: [String], // in_app, email, sms
  relatedData: {
    tellerId: String,
    amount: Number,
    previousValue: Number,
    newValue: Number,
  },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) }, // 30 days
});

// Auto-delete notifications after 30 days
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("Notification", notificationSchema);
