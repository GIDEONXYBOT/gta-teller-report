import mongoose from "mongoose";
import User from "./models/User.js";

const MONGO_URI = "mongodb://localhost:27017/rmi-teller-report";

mongoose.connect(MONGO_URI)
  .then(async () => {
    console.log("✅ Connected to Local MongoDB\n");
    
    // Get all tellers
    const tellers = await User.find({ role: "teller" }).lean();
    
    console.log(`📊 Total tellers: ${tellers.length}\n`);
    console.log("All tellers:");
    tellers.forEach((t, idx) => {
      console.log(`${idx + 1}. ${t.name} (@${t.username})`);
    });
    
    mongoose.connection.close();
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Connection failed:", err.message);
    process.exit(1);
  });
