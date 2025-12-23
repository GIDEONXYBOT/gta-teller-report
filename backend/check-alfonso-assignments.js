// Check supervisor-teller relationships and fix assignments
import mongoose from "mongoose";
import User from "./models/User.js";
import Capital from "./models/Capital.js";
import dotenv from "dotenv";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

async function checkSupervisorRelationships() {
  try {
    console.log("🔌 Connecting to MongoDB Atlas...");
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB Atlas");
    
    // Find Alfonso (the supervisor)
    const alfonso = await User.findOne({ 
      $or: [
        { username: "Alfonso" },
        { name: { $regex: /alfonso/i } }
      ]
    });
    
    if (!alfonso) {
      console.log("❌ Alfonso (supervisor) not found");
      return;
    }
    
    console.log(`👨‍💼 Found Alfonso:`);
    console.log(`   - ID: ${alfonso._id}`);
    console.log(`   - Username: ${alfonso.username}`);
    console.log(`   - Name: ${alfonso.name}`);
    console.log(`   - Role: ${alfonso.role}`);
    console.log(`   - Status: ${alfonso.status}`);
    
    // Find tellers assigned to Alfonso
    const assignedTellers = await User.find({ 
      role: "teller", 
      supervisorId: alfonso._id 
    });
    
    console.log(`\n🏧 Tellers assigned to Alfonso: ${assignedTellers.length}`);
    assignedTellers.forEach(teller => {
      console.log(`   - ${teller.name} (${teller.username}) - Status: ${teller.status}`);
    });
    
    // Find all approved tellers
    const allTellers = await User.find({ 
      role: "teller", 
      status: "approved" 
    });
    
    console.log(`\n📊 All approved tellers: ${allTellers.length}`);
    
    // Find tellers without supervisor assignment
    const unassignedTellers = await User.find({ 
      role: "teller", 
      status: "approved",
      $or: [
        { supervisorId: null },
        { supervisorId: { $exists: false } }
      ]
    });
    
    console.log(`\n⚠️ Unassigned tellers: ${unassignedTellers.length}`);
    unassignedTellers.forEach(teller => {
      console.log(`   - ${teller.name} (${teller.username})`);
    });
    
    // Auto-assign unassigned tellers to Alfonso
    if (unassignedTellers.length > 0) {
      console.log(`\n🔧 Auto-assigning ${unassignedTellers.length} tellers to Alfonso...`);
      
      for (const teller of unassignedTellers) {
        teller.supervisorId = alfonso._id;
        await teller.save();
        console.log(`   ✅ Assigned ${teller.name} to Alfonso`);
      }
    }
    
    // Check capital records for Alfonso's tellers
    const finalTellers = await User.find({ 
      role: "teller", 
      supervisorId: alfonso._id 
    });
    
    console.log(`\n💰 Checking capital records for Alfonso's ${finalTellers.length} tellers:`);
    
    for (const teller of finalTellers) {
      const capitalRecords = await Capital.find({ tellerId: teller._id });
      const totalCapital = capitalRecords.reduce((sum, record) => sum + (record.amount || 0), 0);
      console.log(`   - ${teller.name}: ₱${totalCapital.toLocaleString()} (${capitalRecords.length} records)`);
    }
    
    console.log(`\n🎉 Alfonso should now see ${finalTellers.length} tellers in his overview!`);
    
  } catch (error) {
    console.error("❌ Error checking supervisor relationships:", error.message);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
  }
}

checkSupervisorRelationships();