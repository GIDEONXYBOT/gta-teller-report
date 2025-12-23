// Check Apple's actual report dates
import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./models/User.js";
import TellerReport from "./models/TellerReport.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/rmi_teller_report";

async function checkAppleDates() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");
    
    const apple = await User.findOne({ username: { $regex: /apple/i } });
    if (!apple) {
      console.log("❌ Apple supervisor not found");
      return;
    }
    
    console.log(`👤 Apple: ${apple.username} (${apple._id})`);
    
    // Find all Apple reports and show their actual dates
    const appleReports = await TellerReport.find({ 
      supervisorId: apple._id 
    }).sort({ date: 1 });
    
    console.log(`\n📊 Total Apple reports: ${appleReports.length}`);
    console.log("\n📅 ALL APPLE REPORT DATES:");
    
    appleReports.forEach((report, index) => {
      console.log(`${index + 1}. ${report._id}`);
      
      // Handle different date formats
      const dateValue = report.date;
      const dateDisplay = dateValue ? (
        typeof dateValue.toISOString === 'function' 
          ? dateValue.toISOString()
          : dateValue.toString()
      ) : 'No date';
      
      const createdAtDisplay = report.createdAt ? report.createdAt.toISOString() : 'No createdAt';
      
      console.log(`   📅 date: ${dateDisplay} (type: ${typeof dateValue})`);
      console.log(`   📝 createdAt: ${createdAtDisplay}`);
      console.log(`   👥 Tellers: ${report.tellerDetails ? report.tellerDetails.map(t => t.tellerName).join(', ') : 'None'}`);
      console.log('   ---');
    });
    
    // Group by date
    const dateGroups = {};
    appleReports.forEach(report => {
      let dateKey;
      const dateValue = report.date;
      
      if (dateValue && typeof dateValue.toISOString === 'function') {
        dateKey = dateValue.toISOString().split('T')[0];
      } else if (dateValue) {
        dateKey = dateValue.toString();
      } else {
        dateKey = 'No date';
      }
      
      if (!dateGroups[dateKey]) dateGroups[dateKey] = [];
      dateGroups[dateKey].push(report);
    });
    
    console.log("\n📊 REPORTS GROUPED BY DATE:");
    Object.keys(dateGroups).sort().forEach(date => {
      console.log(`📅 ${date}: ${dateGroups[date].length} reports`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

checkAppleDates();