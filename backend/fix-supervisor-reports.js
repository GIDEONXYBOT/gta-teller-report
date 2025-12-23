// Fix Apple and Marhlien supervisor reports
import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./models/User.js";
import TellerReport from "./models/TellerReport.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/rmi_teller_report";

async function fixSupervisorReports() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");
    
    console.log("\n🔍 Step 1: Checking Apple supervisor reports...");
    const apple = await User.findOne({ username: { $regex: /apple/i } });
    if (!apple) {
      console.log("❌ Apple supervisor not found");
      return;
    }
    
    console.log(`👤 Apple: ${apple.username} (${apple._id})`);
    
    // Find Apple's reports sorted by date
    const appleReports = await TellerReport.find({ supervisorId: apple._id }).sort({ createdAt: 1 });
    console.log(`📊 Apple has ${appleReports.length} reports:`);
    
    appleReports.forEach((r, idx) => {
      console.log(`  ${idx + 1}. ${new Date(r.createdAt).toLocaleDateString()} - Teller: ${r.tellerName} (ID: ${r._id})`);
    });
    
    // Find reports from November 12, 2025
    const nov12Reports = appleReports.filter(r => {
      const date = new Date(r.createdAt);
      return date.getFullYear() === 2025 && 
             date.getMonth() === 10 && // November is month 10
             date.getDate() === 12;
    });
    
    console.log(`\n🗓️ November 12 reports: ${nov12Reports.length}`);
    
    if (nov12Reports.length > 0) {
      console.log("📝 Merging November 12 reports into November 11...");
      
      for (const report of nov12Reports) {
        // Change the date to November 11, 2025
        const nov11Date = new Date('2025-11-11T10:00:00.000Z'); // Set to November 11
        
        console.log(`  Moving report ${report._id} from ${new Date(report.createdAt).toLocaleDateString()} to Nov 11`);
        
        await TellerReport.findByIdAndUpdate(report._id, {
          createdAt: nov11Date,
          updatedAt: nov11Date
        });
      }
      
      console.log("✅ Apple reports merged successfully!");
    } else {
      console.log("ℹ️ No November 12 reports found for Apple");
    }
    
    console.log("\n🔍 Step 2: Checking Marhlien supervisor...");
    const marhlien = await User.findOne({ username: { $regex: /marhlien/i } });
    if (!marhlien) {
      console.log("❌ Marhlien supervisor not found");
      return;
    }
    
    console.log(`👤 Marhlien: ${marhlien.username} (${marhlien._id})`);
    
    // Check if Marhlien has any teller reports
    const marhlienReports = await TellerReport.find({ supervisorId: marhlien._id });
    console.log(`📊 Marhlien has ${marhlienReports.length} reports`);
    
    if (marhlienReports.length === 0) {
      console.log("📝 Creating sample teller report for Marhlien...");
      
      // Find a teller under Marhlien or create reference
      let tellerUnderMarhlien = await User.findOne({ 
        supervisorId: marhlien._id, 
        role: { $in: ['teller', 'supervisor_teller'] } 
      });
      
      if (!tellerUnderMarhlien) {
        // Find any teller to assign to Marhlien temporarily
        tellerUnderMarhlien = await User.findOne({ 
          role: { $in: ['teller', 'supervisor_teller'] },
          status: 'approved'
        });
        
        if (tellerUnderMarhlien) {
          console.log(`📝 Assigning teller ${tellerUnderMarhlien.username} to Marhlien`);
          await User.findByIdAndUpdate(tellerUnderMarhlien._id, {
            supervisorId: marhlien._id
          });
        }
      }
      
      if (tellerUnderMarhlien) {
        // Create a sample report
        const sampleReport = new TellerReport({
          tellerId: tellerUnderMarhlien._id,
          tellerName: tellerUnderMarhlien.name || tellerUnderMarhlien.username,
          supervisorId: marhlien._id,
          supervisorName: marhlien.name || marhlien.username,
          startingCapital: 5000,
          endingCapital: 5200,
          totalSales: 15000,
          totalRemittance: 14800,
          short: 0,
          over: 200,
          cashOnHand: 5200,
          systemBalance: 5000,
          denominationBreakdown: {
            d1000: 3,
            d500: 2,
            d200: 1,
            d100: 0,
            d50: 0,
            d20: 0,
            coins: 0
          },
          verified: true,
          isApproved: false,
          createdAt: new Date('2025-11-10T10:00:00.000Z'), // November 10
          updatedAt: new Date('2025-11-10T10:00:00.000Z')
        });
        
        await sampleReport.save();
        console.log("✅ Sample report created for Marhlien!");
        console.log(`   Teller: ${tellerUnderMarhlien.username}`);
        console.log(`   Date: November 10, 2025`);
        console.log(`   Over: ₱200`);
      } else {
        console.log("❌ No tellers found to assign to Marhlien");
      }
    } else {
      console.log("ℹ️ Marhlien already has teller reports");
      marhlienReports.forEach((r, idx) => {
        console.log(`  ${idx + 1}. ${new Date(r.createdAt).toLocaleDateString()} - Teller: ${r.tellerName}`);
      });
    }
    
    console.log("\n✅ All fixes completed!");
    
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\n🔌 Disconnected from MongoDB");
    process.exit(0);
  }
}

fixSupervisorReports();