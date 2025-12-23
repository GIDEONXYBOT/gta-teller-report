import mongoose from "mongoose";
import User from "./models/User.js";

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/rmi-teller";

mongoose.connect(MONGO_URI)
  .then(async () => {
    console.log("✅ Connected to MongoDB");
    
    // Count tellers
    const tellerCount = await User.countDocuments({ 
      role: { $in: ["teller", "supervisor_teller"] },
      status: "approved"
    });
    
    const tellers = await User.find({ 
      role: { $in: ["teller", "supervisor_teller"] },
      status: "approved"
    }).select("name username role").lean();
    
    console.log(`\n📊 Approved Tellers: ${tellerCount}\n`);
    
    if (tellers.length > 0) {
      console.log("First 10 tellers:");
      tellers.slice(0, 10).forEach((t, i) => {
        console.log(`  ${i + 1}. ${t.name || t.username} (${t.role})`);
      });
    }
    
    mongoose.connection.close();
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Connection failed:", err.message);
    process.exit(1);
  });
