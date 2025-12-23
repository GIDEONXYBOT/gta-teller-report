import mongoose from "mongoose";
import User from "./models/User.js";

const MONGO_URI = "mongodb://localhost:27017/rmi-teller-report";

mongoose.connect(MONGO_URI)
  .then(async () => {
    console.log("✅ Connected to Local MongoDB\n");
    
    try {
      const result = await User.updateMany(
        { role: "teller", baseSalary: { $in: [0, null, undefined] } },
        { $set: { baseSalary: 450 } }
      );
      
      console.log(`✅ Updated ${result.modifiedCount} tellers with base salary ₱450\n`);
      
      // Verify
      const tellers = await User.find({ role: { $in: ["teller", "supervisor"] } })
        .select("name role baseSalary")
        .lean();
      
      console.log("📊 All tellers and supervisors:");
      tellers.forEach(t => {
        console.log(`  - ${t.name} (${t.role}): ₱${t.baseSalary}`);
      });
      
      mongoose.connection.close();
      process.exit(0);
    } catch (err) {
      console.error("❌ Failed:", err.message);
      mongoose.connection.close();
      process.exit(1);
    }
  })
  .catch((err) => {
    console.error("❌ Connection failed:", err.message);
    process.exit(1);
  });
