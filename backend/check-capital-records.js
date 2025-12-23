import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import Capital from "./models/Capital.js";
import User from "./models/User.js";

async function checkCapitalRecords() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    const problematicUsers = ['mlaburada29', '006erika', '021.Irah', '015.mitch', 'yamie22'];
    const workingUsers = ['Marie Q.', 'Dianne008', 'Sheena16'];
    
    console.log("=== CHECKING CAPITAL RECORDS FOR PROBLEMATIC USERS ===");
    
    for (let username of problematicUsers) {
      const user = await User.findOne({ username });
      if (user) {
        const capitals = await Capital.find({ tellerId: user._id }).sort({ createdAt: -1 });
        const activeCapital = await Capital.findOne({ tellerId: user._id, status: 'active' });
        
        console.log(`${username} (${user.name}):`);
        console.log(`  Total Capital Records: ${capitals.length}`);
        console.log(`  Active Capital: ${activeCapital ? 'YES' : 'NO'}`);
        if (activeCapital) {
          console.log(`    Amount: ₱${activeCapital.amount}`);
          console.log(`    Date: ${activeCapital.createdAt}`);
        }
        if (capitals.length > 0) {
          console.log(`  Latest Capital: ${capitals[0].status} - ₱${capitals[0].amount} (${capitals[0].createdAt})`);
        }
        console.log('---');
      }
    }
    
    console.log("\n=== CHECKING CAPITAL RECORDS FOR WORKING USERS ===");
    
    for (let username of workingUsers) {
      const user = await User.findOne({ username });
      if (user) {
        const capitals = await Capital.find({ tellerId: user._id }).sort({ createdAt: -1 });
        const activeCapital = await Capital.findOne({ tellerId: user._id, status: 'active' });
        
        console.log(`${username} (${user.name}):`);
        console.log(`  Total Capital Records: ${capitals.length}`);
        console.log(`  Active Capital: ${activeCapital ? 'YES' : 'NO'}`);
        if (activeCapital) {
          console.log(`    Amount: ₱${activeCapital.amount}`);
          console.log(`    Date: ${activeCapital.createdAt}`);
        }
        if (capitals.length > 0) {
          console.log(`  Latest Capital: ${capitals[0].status} - ₱${capitals[0].amount} (${capitals[0].createdAt})`);
        }
        console.log('---');
      }
    }
    
    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
}

checkCapitalRecords();