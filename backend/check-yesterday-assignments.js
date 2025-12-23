import mongoose from "mongoose";
import DailyTellerAssignment from "./models/DailyTellerAssignment.js";
import { DateTime } from "luxon";

// Connect to MongoDB
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/rmi-teller";

mongoose.connect(MONGO_URI)
  .then(async () => {
    console.log("✅ Connected to MongoDB");
    
    // Get yesterday's date
    const yesterday = DateTime.now().setZone("Asia/Manila").minus({ days: 1 }).toFormat("yyyy-MM-dd");
    console.log(`\n📅 Checking assignments for: ${yesterday}\n`);
    
    // Query assignments
    const assignments = await DailyTellerAssignment.find({ dayKey: yesterday }).lean();
    
    if (assignments.length === 0) {
      console.log("❌ No assignments found for yesterday");
    } else {
      console.log(`✅ Found ${assignments.length} assignments for yesterday:\n`);
      assignments.forEach((a, idx) => {
        console.log(`${idx + 1}. ${a.tellerName} (ID: ${a.tellerId})`);
        console.log(`   Status: ${a.status || 'pending'}`);
        console.log(`   Supervisor: ${a.supervisorName || 'N/A'}`);
        console.log();
      });
    }
    
    mongoose.connection.close();
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Connection failed:", err.message);
    process.exit(1);
  });
