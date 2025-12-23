import express from "express";
import fs from 'fs/promises';
import path from 'path';
import User from "../models/User.js";
import sharp from 'sharp';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// GET: list users (optionally filter by role: /api/users?role=supervisor)
router.get("/", async (req, res) => {
  try {
    const { role } = req.query;
    const filter = {};
    if (role) filter.role = role;
    const users = await User.find(filter).select("-passwordHash");
    res.json(users);
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({ message: "Failed to fetch users" });
  }
});

// GET /api/users/:id - public user profile (no password)
router.get('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const user = await User.findById(id).select('-password -passwordHash');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    console.error('Failed to fetch user:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET pending users
router.get("/pending", async (req, res) => {
  try {
    const users = await User.find({ active: false });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch pending users" });
  }
});

// Approve or deactivate a user
router.put("/:id/approve", async (req, res) => {
  try {
    const { active } = req.body;
    await User.findByIdAndUpdate(req.params.id, { active });
    res.json({ message: "User status updated" });
  } catch (err) {
    res.status(500).json({ message: "Failed to update user status" });
  }
});

// Get assistant admin
router.get("/assistant", async (req, res) => {
  try {
    const assistant = await User.findOne({ isAssistantAdmin: true }).select("-passwordHash");
    res.json(assistant || null);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch assistant admin" });
  }
});

// PUT /api/users/me/avatar
// Accepts JSON: { image: 'data:image/png;base64,...' } or raw base64 string
router.put('/me/avatar', requireAuth, async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) return res.status(400).json({ message: 'No image provided' });

    // parse data URL or base64
    let data = image;
    let ext = 'png';
    const match = data.match(/^data:(image\/(\w+));base64,(.*)$/);
    if (match) {
      ext = match[2] || 'png';
      data = match[3];
    } else {
      // try to detect when a file is passed as base64 without prefix
      // default to png
      ext = (data.startsWith('/') ? 'jpg' : 'png');
    }

    const buffer = Buffer.from(data, 'base64');

    // Server-side validations
    const MIN_WIDTH = 128;
    const MIN_HEIGHT = 128;
    const MIN_BYTES = 8 * 1024; // 8 KB

    if (buffer.length < MIN_BYTES) {
      return res.status(400).json({ success: false, message: `Image file size must be >= ${MIN_BYTES} bytes` });
    }

    // read metadata using sharp
    let meta;
    try {
      meta = await sharp(buffer).metadata();
    } catch (merr) {
      console.error('Failed to read image metadata:', merr?.message || merr);
      return res.status(400).json({ success: false, message: 'Invalid image data' });
    }

    if (!meta || !meta.width || !meta.height) {
      return res.status(400).json({ success: false, message: 'Invalid image or missing dimensions' });
    }

    if (meta.width < MIN_WIDTH || meta.height < MIN_HEIGHT) {
      return res.status(400).json({ success: false, message: `Image dimensions too small — minimum ${MIN_WIDTH}x${MIN_HEIGHT}px required` });
    }

    // ensure uploads dir exists
    const uploadsDir = path.resolve('uploads', 'avatars');
    await fs.mkdir(uploadsDir, { recursive: true });

    // Remove existing avatars for user
    try {
      const baseName = req.user._id.toString();
      const oldFiles = [`${baseName}.png`, `${baseName}.jpg`, `${baseName}.jpeg`, `${baseName}-sm.png`, `${baseName}-md.png`, `${baseName}-lg.png`];
      for (const f of oldFiles) {
        try { await fs.unlink(path.join(uploadsDir, f)); } catch (_) { /* ignore */ }
      }
    } catch (remErr) {
      // ignore remove errors
    }

    // Create and save three sizes (sm/md/lg)
    const idBase = req.user._id.toString();
    const smName = `${idBase}-sm.png`;
    const mdName = `${idBase}-md.png`;
    const lgName = `${idBase}-lg.png`;

    // save large (512x512), medium (128x128), small (32x32)
    try {
      await sharp(buffer)
        .resize({ width: 512, height: 512, fit: 'cover' })
        .png({ quality: 90 })
        .toFile(path.join(uploadsDir, lgName));

      await sharp(buffer)
        .resize({ width: 128, height: 128, fit: 'cover' })
        .png({ quality: 85 })
        .toFile(path.join(uploadsDir, mdName));

      await sharp(buffer)
        .resize({ width: 32, height: 32, fit: 'cover' })
        .png({ quality: 80 })
        .toFile(path.join(uploadsDir, smName));
    } catch (procErr) {
      console.error('Failed to process avatar images:', procErr?.message || procErr);
      return res.status(500).json({ success: false, message: 'Failed to process avatar image' });
    }

    // Save paths on user
    const avatarUrl = `/uploads/avatars/${mdName}`;
    req.user.avatarUrl = avatarUrl;
    req.user.avatarSizes = {
      sm: `/uploads/avatars/${smName}`,
      md: `/uploads/avatars/${mdName}`,
      lg: `/uploads/avatars/${lgName}`
    };
    await req.user.save();

    res.json({ success: true, avatarUrl: req.user.avatarUrl, avatarSizes: req.user.avatarSizes, user: req.user });
  } catch (err) {
    console.error('Failed to upload avatar:', err.message || err);
    res.status(500).json({ success: false, message: 'Failed to upload avatar', error: err.message });
  }
});

// DELETE /api/users/me/avatar - remove avatar files and clear user fields
router.delete('/me/avatar', requireAuth, async (req, res) => {
  try {
    const uploadsDir = path.resolve('uploads', 'avatars');
    const idBase = req.user._id.toString();
    const files = [`${idBase}-sm.png`, `${idBase}-md.png`, `${idBase}-lg.png`, `${idBase}.png`, `${idBase}.jpg`, `${idBase}.jpeg`];
    for (const f of files) {
      try { await fs.unlink(path.join(uploadsDir, f)); } catch (e) { /* ignore */ }
    }

    req.user.avatarUrl = '';
    req.user.avatarSizes = { sm: '', md: '', lg: '' };
    await req.user.save();
    res.json({ success: true, message: 'Avatar removed', user: req.user });
  } catch (err) {
    console.error('Failed to delete avatar:', err.message || err);
    res.status(500).json({ success: false, message: 'Failed to delete avatar' });
  }
});

// PUT /api/users/profile - update own profile (name and username)
router.put('/profile', requireAuth, async (req, res) => {
  try {
    const { name, username } = req.body;

    // Validate required fields
    if (!name || !username) {
      return res.status(400).json({ message: 'Name and username are required' });
    }

    // Trim whitespace
    const trimmedName = name.trim();
    const trimmedUsername = username.trim();

    if (!trimmedName || !trimmedUsername) {
      return res.status(400).json({ message: 'Name and username cannot be empty' });
    }

    // Check if username is already taken by another user
    const existingUser = await User.findOne({
      username: trimmedUsername,
      _id: { $ne: req.user._id }
    });

    if (existingUser) {
      return res.status(400).json({ message: 'Username is already taken' });
    }

    // Update user profile
    req.user.name = trimmedName;
    req.user.username = trimmedUsername;
    await req.user.save();

    // Return updated user (without password)
    const updatedUser = await User.findById(req.user._id).select('-password -passwordHash');
    res.json({
      message: 'Profile updated successfully',
      user: updatedUser
    });

  } catch (err) {
    console.error('Failed to update profile:', err);
    res.status(500).json({ message: 'Failed to update profile' });
  }
});

export default router;

