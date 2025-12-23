import mongoose from "mongoose";
import User from "./models/User.js";
import bcrypt from "bcryptjs";

const tellersData = [
  "Marebelen",
  "Marilou",
  "Jesyrie",
  "Shane",
  "Julieta",
  "Jenessa",
  "Tessa",
  "Shymaine",
  "Karyle",
  "Michelle"
];

// Try local MongoDB first
const MONGO_URI = "mongodb://localhost:27017/rmi-teller-report";

mongoose.connect(MONGO_URI, {
  serverSelectionTimeoutMS: 5000,
})
  .then(async () => {
    console.log("✅ Connected to Local MongoDB\n");
    
    const hashedPassword = await bcrypt.hash("password123", 10);
    const now = new Date();
    
    const usersToInsert = tellersData.map(name => ({
      name: name.trim(),
      username: name.trim().toLowerCase().replace(/\s+/g, ''),
      email: `${name.trim().toLowerCase().replace(/\s+/g, '')}@rmi.com`,
      password: hashedPassword,
      role: "teller",
      status: "approved",
      totalWorkDays: 0,
      lastWorked: now,
      createdAt: now,
      updatedAt: now,
    }));
    
    try {
      // Clear existing tellers first
      await User.deleteMany({ role: "teller" });
      console.log("✅ Cleared existing tellers\n");
      
      // Insert new users
      const result = await User.insertMany(usersToInsert);
      console.log(`✅ Successfully restored ${result.length} tellers:\n`);
      
      result.forEach((user, idx) => {
        console.log(`${idx + 1}. ${user.name} (@${user.username})`);
      });
      
      console.log("\n✅ All tellers ready for schedule generation!");
      
      // Verify count
      const count = await User.countDocuments({ role: "teller" });
      console.log(`📊 Total tellers in database: ${count}`);
      
      mongoose.connection.close();
      process.exit(0);
    } catch (err) {
      console.error("❌ Failed to insert tellers:", err.message);
      mongoose.connection.close();
      process.exit(1);
    }
  })
  .catch((err) => {
    console.error("❌ Local MongoDB connection failed:", err.message);
    console.error("\n⚠️ Make sure MongoDB is running locally on port 27017");
    console.error("   Start it with: mongod");
    process.exit(1);
  });
