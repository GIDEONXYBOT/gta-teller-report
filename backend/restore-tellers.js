import mongoose from "mongoose";
import User from "./models/User.js";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/rmi-teller-report";

const MONGO_URI = "mongodb://localhost:27017/rmi-teller-report";

const tellersToCreate = [
  { name: "Marebelen", username: "marebelen", fullweek: true },
  { name: "Marilou", username: "marilou", fullweek: true },
  { name: "Jesyrie", username: "jesyrie", fullweek: true },
  { name: "Shane", username: "shane", fullweek: false },
  { name: "Julieta", username: "julieta", fullweek: false },
  { name: "Jenessa", username: "jenessa", fullweek: false },
  { name: "Tessa", username: "tessa", fullweek: false },
  { name: "Shymaine", username: "shymaine", fullweek: false },
  { name: "Karyle", username: "karyle", fullweek: false },
  { name: "Michelle", username: "michelle", fullweek: false },
];

mongoose.connect(MONGO_URI)
  .then(async () => {
    console.log("✅ Connected to Cloud Atlas MongoDB\n");
    
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
    
    try {
      // Check if users already exist
      const existingCount = await User.countDocuments();
      if (existingCount > 0) {
        console.log(`⚠️  Database already has ${existingCount} users. Clearing first...\n`);
        await User.deleteMany({});
        console.log("✅ Cleared existing users\n");
      }
      
      // Insert new users
      const result = await User.insertMany(usersToInsert);
      console.log(`✅ Successfully created ${result.length} tellers:\n`);
      
      result.forEach((user, idx) => {
        console.log(`${idx + 1}. ${user.name} (${user.username})`);
        console.log(`   Role: ${user.role} | Status: ${user.status}`);
        console.log(`   ID: ${user._id}\n`);
      });
      
      console.log("✅ All tellers ready for schedule generation!");
      mongoose.connection.close();
      process.exit(0);
    } catch (err) {
      console.error("❌ Failed to insert tellers:", err.message);
      mongoose.connection.close();
      process.exit(1);
    }
  })
  .catch((err) => {
    console.error("❌ Connection failed:", err.message);
    process.exit(1);
  });
