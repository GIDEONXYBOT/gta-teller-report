import express from "express";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import User from "../models/User.js";

dotenv.config();
const router = express.Router();

// Register (use for initial seeding / admin creation)
// In production restrict this or remove after creating accounts.
router.post("/register", async (req, res) => {
  try {
    const { username, password, name, role } = req.body;
    if (!username || !password || !name) {
      return res.status(400).json({ message: "Missing fields" });
    }
    const existing = await User.findOne({ username });
    if (existing) return res.status(400).json({ message: "User exists" });

    const user = new User({ 
      username, 
      password, 
      plainTextPassword: password, // ✅ Store plain text for admin
      name, 
      role: role || "supervisor" 
    });
    await user.save();
    res.json({ message: "User registered" });
  } catch (err) {
    console.error("❌ Register error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Login
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    console.log(`🔐 Login attempt: username="${username}"`);
    console.log(`📱 User-Agent: ${req.headers['user-agent']?.substring(0, 100) || 'Unknown'}`);
    console.log(`🌐 Origin: ${req.headers.origin || 'No Origin'}`);
    console.log(`📍 IP Address: ${req.ip || req.connection.remoteAddress || 'Unknown'}`);
    
    if (!username || !password) {
      console.log(`❌ Missing fields: username=${!!username}, password=${!!password}`);
      return res.status(400).json({ message: "Missing fields" });
    }

    const user = await User.findOne({ username });
    if (!user) {
      console.log(`❌ User not found: ${username}`);
      return res.status(404).json({ message: "User not found" });
    }

    console.log(`👤 Found user: ${user.username}, role: ${user.role}, status: ${user.status}`);
    console.log(`🔑 Stored password hash: ${user.password?.substring(0, 20)}...`);
    console.log(`📝 Plain text password: ${user.plainTextPassword}`);

    // Check if password is hashed (starts with $2b$ for bcrypt)
    const isHashed = user.password?.startsWith('$2b$') || user.password?.startsWith('$2a$');
    console.log(`🔍 Password is hashed: ${isHashed}`);

    const ok = await user.comparePassword(password);
    console.log(`🔐 Bcrypt compare result: ${ok}`);
    
    if (!ok) {
      console.log(`❌ Password comparison failed for user: ${username}`);
      return res.status(401).json({ message: "Invalid credentials" });
    }

    console.log(`✅ Login successful for ${username}`);

    const token = jwt.sign(
      { id: user._id, role: user.role, name: user.name, username: user.username },
      process.env.JWT_SECRET || "devsecret",
      { expiresIn: "1d" }
    );

    res.json({
      token,
      user: { id: user._id, name: user.name, username: user.username, role: user.role },
    });
  } catch (err) {
    console.error("❌ Login error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
