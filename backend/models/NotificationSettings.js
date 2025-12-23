import mongoose from "mongoose";

const notificationSettingsSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  inAppNotifications: { type: Boolean, default: true },
  emailNotifications: { type: Boolean, default: false },
  smsNotifications: { type: Boolean, default: false },
  emailAddress: String,
  phoneNumber: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

export default mongoose.model("NotificationSettings", notificationSettingsSchema);
