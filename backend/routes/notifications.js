import express from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import Notification from "../models/Notification.js";
import NotificationRule from "../models/NotificationRule.js";
import NotificationSettings from "../models/NotificationSettings.js";

const router = express.Router();

// Get all notifications for user
router.get("/list", requireAuth, async (req, res) => {
  try {
    const notifications = await Notification.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json({ success: true, data: notifications });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Mark notification as read
router.put("/:id/read", requireAuth, async (req, res) => {
  try {
    const notification = await Notification.findByIdAndUpdate(
      req.params.id,
      { read: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ success: false, error: "Notification not found" });
    }

    res.json({ success: true, data: notification });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete notification
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const notification = await Notification.findByIdAndDelete(req.params.id);

    if (!notification) {
      return res.status(404).json({ success: false, error: "Notification not found" });
    }

    res.json({ success: true, message: "Notification deleted" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get all notification rules
router.get("/rules", requireAuth, requireRole(["admin", "super_admin"]), async (req, res) => {
  try {
    const rules = await NotificationRule.find().sort({ createdAt: -1 });
    res.json({ success: true, data: rules });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Create notification rule
router.post("/rules/create", requireAuth, requireRole(["admin", "super_admin"]), async (req, res) => {
  try {
    const { name, type, threshold, condition, channels, enabled } = req.body;

    if (!name || !type) {
      return res.status(400).json({ success: false, error: "Name and type are required" });
    }

    const rule = new NotificationRule({
      name,
      type,
      threshold,
      condition,
      channels: channels || ["in_app"],
      enabled: enabled !== false,
      createdBy: req.user.id,
    });

    await rule.save();
    res.json({ success: true, data: rule });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update notification rule
router.put("/rules/:id", requireAuth, requireRole(["admin", "super_admin"]), async (req, res) => {
  try {
    const rule = await NotificationRule.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    if (!rule) {
      return res.status(404).json({ success: false, error: "Rule not found" });
    }

    res.json({ success: true, data: rule });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete notification rule
router.delete("/rules/:id", requireAuth, requireRole(["admin", "super_admin"]), async (req, res) => {
  try {
    const rule = await NotificationRule.findByIdAndDelete(req.params.id);

    if (!rule) {
      return res.status(404).json({ success: false, error: "Rule not found" });
    }

    res.json({ success: true, message: "Rule deleted" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get notification settings
router.get("/settings", requireAuth, async (req, res) => {
  try {
    let settings = await NotificationSettings.findOne({ userId: req.user.id });

    if (!settings) {
      settings = new NotificationSettings({
        userId: req.user.id,
        inAppNotifications: true,
        emailNotifications: false,
        smsNotifications: false,
      });
      await settings.save();
    }

    res.json({ success: true, data: settings });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update notification settings
router.put("/settings", requireAuth, async (req, res) => {
  try {
    let settings = await NotificationSettings.findOne({ userId: req.user.id });

    if (!settings) {
      settings = new NotificationSettings({ userId: req.user.id });
    }

    Object.assign(settings, req.body);
    await settings.save();

    res.json({ success: true, data: settings });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
