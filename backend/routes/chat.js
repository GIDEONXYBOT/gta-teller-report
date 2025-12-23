import express from "express";
import Chat from "../models/ChatMessage.js";

const router = express.Router();

// ✅ Fetch chat history (group or private)
router.get("/", async (req, res) => {
  try {
    const { userId, receiverId } = req.query;
    let filter = {};

    if (userId && receiverId) {
      filter = {
        $or: [
          { senderId: userId, receiverId },
          { senderId: receiverId, receiverId: userId },
        ],
      };
    }

    const messages = await Chat.find(filter).sort({ createdAt: 1 });
    res.json({ messages });
  } catch (err) {
    console.error("❌ Chat fetch error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ✅ Send message (safe + private emit)
router.post("/", async (req, res) => {
  try {
    const { senderId, senderName, role, receiverId, text } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: "Empty message" });

    const message = await Chat.create({
      senderId,
      senderName,
      role,
      receiverId,
      text,
      createdAt: new Date(),
    });

    // ---- Socket emit ----
    if (req.app.io) {
      if (!global.sentMessages) global.sentMessages = new Set();
      const msgId = String(message._id);
      if (global.sentMessages.has(msgId)) return res.json({ success: true, message });
      global.sentMessages.add(msgId);
      setTimeout(() => global.sentMessages.delete(msgId), 5000);

      // PRIVATE CHAT
      if (receiverId) {
        const sockets = Array.from(req.app.io.sockets.sockets.values());

        const receiverSocket = sockets.find(
          (s) => s.user && s.user._id === receiverId
        );
        const senderSocket = sockets.find(
          (s) => s.user && s.user._id === senderId
        );

        if (receiverSocket) receiverSocket.emit("newMessage", message);
        if (senderSocket) senderSocket.emit("newMessage", message);
      } else {
        // GROUP CHAT
        req.app.io.emit("newMessage", message);
      }
    }

    res.json({ success: true, message });
  } catch (err) {
    console.error("❌ Chat save failed:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ✅ Delete all
router.delete("/", async (req, res) => {
  try {
    await Chat.deleteMany({});
    if (req.app.io) req.app.io.emit("clearAllMessages");
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Delete failed:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
