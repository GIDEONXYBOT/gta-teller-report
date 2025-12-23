import mongoose from "mongoose";

const chatMessageSchema = new mongoose.Schema(
  {
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    senderName: { type: String, required: true },
    role: { type: String },
    receiverId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }, // null = group
    text: { type: String, required: true },
  },
  { timestamps: true }
);

// ✅ Index for fast queries (sender/receiver filtering)
chatMessageSchema.index({ senderId: 1, receiverId: 1, createdAt: 1 });

export default mongoose.model("ChatMessage", chatMessageSchema);
