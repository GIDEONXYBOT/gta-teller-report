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

// Try Cloud Atlas
const MONGO_URI = "mongodb+srv://rmi_admin:rmi1234@rmi-teller-report.fphrmaw.mongodb.net/rmi?retryWrites=true&w=majority";

mongoose.connect(MONGO_URI, {
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000
})
  .then(async () => {
    console.log("✅ Connected to Cloud Atlas MongoDB\n");
    
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
        console.log(`${idx + 1}. ${user.name}`);
        console.log(`   Username: ${user.username}`);
        console.log(`   Role: ${user.role} | Status: ${user.status}\n`);
      });
      
      console.log("✅ All tellers ready for schedule generation!");
      
      // Verify count
      const count = await User.countDocuments({ role: "teller" });
      console.log(`\n📊 Total tellers in database: ${count}`);
      
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
    console.error("\n⚠️ Possible issues:");
    console.error("1. Wrong username/password");
    console.error("2. Wrong database name");
    console.error("3. IP not whitelisted in MongoDB Atlas");
    console.error("4. Connection string formatting error");
    process.exit(1);
  });
