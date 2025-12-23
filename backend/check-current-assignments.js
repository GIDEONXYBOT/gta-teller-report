// Check and display current daily assignments for Alfonso
import mongoose from "mongoose";
import User from "./models/User.js";
import DailyTellerAssignment from "./models/DailyTellerAssignment.js";
import { DateTime } from "luxon";
import dotenv from "dotenv";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

async function checkCurrentAssignments() {
  try {
    console.log("🔌 Connecting to MongoDB Atlas...");
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB Atlas");
    
    const today = DateTime.now().setZone("Asia/Manila").toFormat("yyyy-MM-dd");
    console.log(`📅 Checking assignments for: ${today}`);
    
    // Find Alfonso
    const alfonso = await User.findOne({ username: "Alfonso" });
    if (!alfonso) {
      console.log("❌ Alfonso not found");
      return;
    }
    
    // Get ALL existing assignments for today and Alfonso
    const existingAssignments = await DailyTellerAssignment.find({ 
      dayKey: today,
      supervisorId: alfonso._id 
    }).populate('tellerId', 'name username');
    
    console.log(`\n📋 Current assignments for Alfonso today: ${existingAssignments.length}`);
    existingAssignments.forEach((assignment, index) => {
      const tellerName = assignment.tellerId?.name || assignment.tellerName || 'Unknown';
      const tellerUsername = assignment.tellerId?.username || 'no-username';
      console.log(`   ${index + 1}. ${tellerName} (${tellerUsername}) - Status: ${assignment.status}`);
    });
    
    // Get Alfonso's total assigned tellers
    const allTellers = await User.find({ 
      role: "teller", 
      supervisorId: alfonso._id,
      status: "approved"
    });
    
    console.log(`\n👥 Alfonso's total assigned tellers: ${allTellers.length}`);
    allTellers.forEach((teller, index) => {
      console.log(`   ${index + 1}. ${teller.name} (${teller.username})`);
    });
    
    // Check which tellers are missing assignments
    const assignedTellerIds = new Set(existingAssignments.map(a => a.tellerId?._id?.toString() || a.tellerId?.toString()));
    const missingTellers = allTellers.filter(teller => !assignedTellerIds.has(teller._id.toString()));
    
    console.log(`\n⚠️ Tellers missing assignments: ${missingTellers.length}`);
    if (missingTellers.length > 0) {
      missingTellers.forEach((teller, index) => {
        console.log(`   ${index + 1}. ${teller.name} (${teller.username})`);
      });
    }
    
    console.log(`\n📊 SUMMARY:`);
    console.log(`   - Alfonso's total tellers: ${allTellers.length}`);
    console.log(`   - Current daily assignments: ${existingAssignments.length}`);
    console.log(`   - Missing assignments: ${missingTellers.length}`);
    
    if (existingAssignments.length > 0) {
      console.log(`\n✅ Alfonso should be able to see his tellers in the overview!`);
    } else {
      console.log(`\n❌ No assignments found - Alfonso won't see any tellers!`);
    }
    
  } catch (error) {
    console.error("❌ Error checking assignments:", error.message);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
  }
}

checkCurrentAssignments();