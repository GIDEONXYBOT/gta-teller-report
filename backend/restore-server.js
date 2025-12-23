import express from "express";
import mongoose from "mongoose";
import User from "./models/User.js";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

const tellersToCreate = [
  { name: "Marebelen", username: "marebelen" },
  { name: "Marilou", username: "marilou" },
  { name: "Jesyrie", username: "jesyrie" },
  { name: "Shane", username: "shane" },
  { name: "Julieta", username: "julieta" },
  { name: "Jenessa", username: "jenessa" },
  { name: "Tessa", username: "tessa" },
  { name: "Shymaine", username: "shymaine" },
  { name: "Karyle", username: "karyle" },
  { name: "Michelle", username: "michelle" },
];

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ Connected to MongoDB");
    
    app.post("/api/restore-tellers", async (req, res) => {
      try {
        console.log("\n🔄 Starting teller restoration...");
        
        const hashedPassword = await bcrypt.hash("password123", 10);
        const now = new Date();
        
        const usersToInsert = tellersToCreate.map(t => ({
          name: t.name,
          username: t.username,
          email: `${t.username}@rmi.com`,
          password: hashedPassword,
          role: "teller",
          status: "approved",
          totalWorkDays: 0,
          lastWorked: now,
          createdAt: now,
          updatedAt: now,
        }));
        
        // Delete existing users first
        await User.deleteMany({});
        console.log("✅ Cleared existing users");
        
        // Insert new users
        const result = await User.insertMany(usersToInsert);
        console.log(`✅ Created ${result.length} tellers`);
        
        res.json({ 
          success: true, 
          message: `Successfully created ${result.length} tellers`,
          tellers: result.map(u => ({ _id: u._id, name: u.name, username: u.username, role: u.role, status: u.status }))
        });
      } catch (err) {
        console.error("❌ Error:", err.message);
        res.status(500).json({ error: err.message });
      }
    });
    
    app.listen(5001, () => {
      console.log("🚀 Restoration server running on http://localhost:5001");
      console.log("\nCall POST /api/restore-tellers to restore tellers");
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB connection failed:", err.message);
    process.exit(1);
  });
