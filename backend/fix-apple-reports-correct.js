// Fix Apple supervisor reports - corrected version
import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./models/User.js";
import TellerReport from "./models/TellerReport.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/rmi_teller_report";

async function fixAppleReports() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");
    
    console.log("\n🔍 Checking Apple supervisor reports...");
    const apple = await User.findOne({ username: { $regex: /apple/i } });
    if (!apple) {
      console.log("❌ Apple supervisor not found");
      return;
    }
    
    console.log(`👤 Apple: ${apple.username} (${apple._id})`);
    
    // Find all Apple reports
    const appleReports = await TellerReport.find({ supervisorId: apple._id }).sort({ date: 1 });
    console.log(`📊 Total Apple reports: ${appleReports.length}`);
    
    // Check November 11 and 12, 2024 reports
    const nov11Reports = await TellerReport.find({
      supervisorId: apple._id,
      date: { 
        $gte: new Date('2024-11-11T00:00:00.000Z'),
        $lt: new Date('2024-11-12T00:00:00.000Z')
      }
    });
    
    const nov12Reports = await TellerReport.find({
      supervisorId: apple._id,
      date: { 
        $gte: new Date('2024-11-12T00:00:00.000Z'),
        $lt: new Date('2024-11-13T00:00:00.000Z')
      }
    });
    
    console.log(`📅 November 11, 2024 reports: ${nov11Reports.length}`);
    console.log(`📅 November 12, 2024 reports: ${nov12Reports.length}`);
    
    if (nov12Reports.length > 0) {
      console.log("🔧 FIXING: Moving November 12 reports to November 11...");
      
      for (const report of nov12Reports) {
        // THIS TIME UPDATE THE DATE FIELD TOO!
        const nov11Date = new Date('2024-11-11T10:00:00.000Z');
        
        console.log(`  📝 Moving report ${report._id}`);
        console.log(`      From: ${report.date.toISOString().split('T')[0]}`);
        console.log(`      To: 2024-11-11`);
        
        await TellerReport.findByIdAndUpdate(report._id, {
          date: nov11Date,        // ✅ THIS WAS MISSING BEFORE!
          createdAt: nov11Date,
          updatedAt: nov11Date
        });
        
        console.log(`  ✅ Updated report ${report._id}`);
      }
      
      console.log("✅ All November 12 reports moved to November 11!");
    } else {
      console.log("ℹ️ No November 12 reports found for Apple - already fixed or no duplicates");
    }
    
    // Verify the fix
    console.log("\n🔍 VERIFICATION:");
    const nov11AfterFix = await TellerReport.find({
      supervisorId: apple._id,
      date: { 
        $gte: new Date('2024-11-11T00:00:00.000Z'),
        $lt: new Date('2024-11-12T00:00:00.000Z')
      }
    });
    
    const nov12AfterFix = await TellerReport.find({
      supervisorId: apple._id,
      date: { 
        $gte: new Date('2024-11-12T00:00:00.000Z'),
        $lt: new Date('2024-11-13T00:00:00.000Z')
      }
    });
    
    console.log(`📅 After fix - November 11 reports: ${nov11AfterFix.length}`);
    console.log(`📅 After fix - November 12 reports: ${nov12AfterFix.length}`);
    
    if (nov12AfterFix.length === 0) {
      console.log("🎉 SUCCESS! No more duplicate November 12 reports for Apple");
    } else {
      console.log("⚠️  Still have November 12 reports - something went wrong");
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log("📝 Database connection closed");
  }
}

fixAppleReports();