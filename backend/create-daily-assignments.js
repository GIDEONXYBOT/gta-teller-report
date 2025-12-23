// Create daily teller assignments for Alfonso's tellers
import mongoose from "mongoose";
import User from "./models/User.js";
import DailyTellerAssignment from "./models/DailyTellerAssignment.js";
import { DateTime } from "luxon";
import dotenv from "dotenv";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

async function createDailyAssignments() {
  try {
    console.log("🔌 Connecting to MongoDB Atlas...");
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB Atlas");
    
    const today = DateTime.now().setZone("Asia/Manila").toFormat("yyyy-MM-dd");
    console.log(`📅 Creating assignments for: ${today}`);
    
    // Find Alfonso
    const alfonso = await User.findOne({ username: "Alfonso" });
    if (!alfonso) {
      console.log("❌ Alfonso not found");
      return;
    }
    
    console.log(`👨‍💼 Alfonso ID: ${alfonso._id}`);
    
    // Find his assigned tellers
    const tellers = await User.find({ 
      role: "teller", 
      supervisorId: alfonso._id,
      status: "approved"
    });
    
    console.log(`🏧 Found ${tellers.length} tellers assigned to Alfonso`);
    
    // Check existing daily assignments for today
    const existingAssignments = await DailyTellerAssignment.find({ 
      dayKey: today,
      supervisorId: alfonso._id 
    });
    
    console.log(`📋 Existing assignments for today: ${existingAssignments.length}`);
    
    if (existingAssignments.length > 0) {
      console.log("ℹ️ Daily assignments already exist for today:");
      existingAssignments.forEach(assignment => {
        console.log(`   - ${assignment.tellerName} (${assignment.status})`);
      });
    } else {
      console.log("🔧 Creating new daily assignments...");
      
      const newAssignments = [];
      
      for (const teller of tellers) {
        const assignment = {
          dayKey: today,
          tellerId: teller._id,
          tellerName: teller.name,
          supervisorId: alfonso._id,
          supervisorName: alfonso.name,
          status: "active"
        };
        
        newAssignments.push(assignment);
        console.log(`   ✅ Prepared assignment for ${teller.name}`);
      }
      
      if (newAssignments.length > 0) {
        await DailyTellerAssignment.insertMany(newAssignments);
        console.log(`🎉 Created ${newAssignments.length} daily assignments!`);
      }
    }
    
    // Verify the assignments are working
    const finalAssignments = await DailyTellerAssignment.find({ 
      dayKey: today,
      supervisorId: alfonso._id 
    });
    
    console.log(`\n✅ Final check: ${finalAssignments.length} assignments for Alfonso today`);
    console.log("📊 Alfonso should now see his tellers in the overview!");
    
  } catch (error) {
    console.error("❌ Error creating daily assignments:", error.message);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
  }
}

createDailyAssignments();