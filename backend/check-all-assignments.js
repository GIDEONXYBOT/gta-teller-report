import mongoose from "mongoose";
import DailyTellerAssignment from "./models/DailyTellerAssignment.js";

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/rmi-teller";

mongoose.connect(MONGO_URI)
  .then(async () => {
    console.log("✅ Connected to MongoDB");
    
    const count = await DailyTellerAssignment.countDocuments();
    const recent = await DailyTellerAssignment.find().sort({_id: -1}).limit(5).lean();
    
    console.log(`\n📊 Total assignments in database: ${count}`);
    console.log('\n🔍 Most recent 5 assignments:');
    
    if (recent.length === 0) {
      console.log("  ❌ None found");
    } else {
      recent.forEach(a => {
        console.log(`  - ${a.dayKey}: ${a.tellerName} (Status: ${a.status || 'pending'})`);
      });
    }
    
    mongoose.connection.close();
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Connection failed:", err.message);
    process.exit(1);
  });
