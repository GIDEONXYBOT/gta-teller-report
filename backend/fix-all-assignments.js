// Create complete daily assignments for all of Alfonso's tellers
import mongoose from "mongoose";
import User from "./models/User.js";
import DailyTellerAssignment from "./models/DailyTellerAssignment.js";
import { DateTime } from "luxon";
import dotenv from "dotenv";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

async function fixAllDailyAssignments() {
  try {
    console.log("🔌 Connecting to MongoDB Atlas...");
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB Atlas");
    
    const today = DateTime.now().setZone("Asia/Manila").toFormat("yyyy-MM-dd");
    console.log(`📅 Fixing assignments for: ${today}`);
    
    // Find Alfonso
    const alfonso = await User.findOne({ username: "Alfonso" });
    if (!alfonso) {
      console.log("❌ Alfonso not found");
      return;
    }
    
    console.log(`👨‍💼 Alfonso ID: ${alfonso._id}`);
    
    // Find ALL his assigned tellers
    const allTellers = await User.find({ 
      role: "teller", 
      supervisorId: alfonso._id,
      status: "approved"
    });
    
    console.log(`🏧 Alfonso has ${allTellers.length} assigned tellers total`);
    
    // Get existing assignments
    const existingAssignments = await DailyTellerAssignment.find({ 
      dayKey: today,
      supervisorId: alfonso._id 
    });
    
    const existingTellerIds = new Set(existingAssignments.map(a => a.tellerId.toString()));
    console.log(`📋 Existing assignments: ${existingAssignments.length}`);
    
    // Find tellers without daily assignments
    const tellersWithoutAssignments = allTellers.filter(teller => 
      !existingTellerIds.has(teller._id.toString())
    );
    
    console.log(`⚠️ Tellers missing daily assignments: ${tellersWithoutAssignments.length}`);
    
    if (tellersWithoutAssignments.length > 0) {
      console.log("🔧 Creating missing daily assignments...");
      
      const newAssignments = [];
      
      for (const teller of tellersWithoutAssignments) {
        const assignment = {
          dayKey: today,
          tellerId: teller._id,
          tellerName: teller.name,
          supervisorId: alfonso._id,
          supervisorName: alfonso.name,
          status: "scheduled"
        };
        
        newAssignments.push(assignment);
        console.log(`   ✅ Creating assignment for ${teller.name}`);
      }
      
      await DailyTellerAssignment.insertMany(newAssignments);
      console.log(`🎉 Created ${newAssignments.length} new assignments!`);
    }
    
    // Final verification
    const finalAssignments = await DailyTellerAssignment.find({ 
      dayKey: today,
      supervisorId: alfonso._id 
    });
    
    console.log(`\n📊 FINAL RESULT:`);
    console.log(`   - Alfonso's total tellers: ${allTellers.length}`);
    console.log(`   - Daily assignments: ${finalAssignments.length}`);
    console.log(`   - Match: ${allTellers.length === finalAssignments.length ? '✅ YES' : '❌ NO'}`);
    
    console.log(`\n📋 All assignments for today:`);
    finalAssignments.forEach(assignment => {
      console.log(`   - ${assignment.tellerName} (${assignment.status})`);
    });
    
    console.log(`\n🎉 Alfonso should now see ALL ${finalAssignments.length} tellers in his overview!`);
    
  } catch (error) {
    console.error("❌ Error fixing daily assignments:", error.message);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
  }
}

fixAllDailyAssignments();