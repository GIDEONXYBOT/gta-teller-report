// Check for November 2025 duplicates
import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./models/User.js";
import TellerReport from "./models/TellerReport.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/rmi_teller_report";

async function checkNovember2025() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");
    
    const apple = await User.findOne({ username: { $regex: /apple/i } });
    if (!apple) {
      console.log("❌ Apple supervisor not found");
      return;
    }
    
    // Since dates are strings, let's check string patterns
    const nov11_2025 = await TellerReport.find({
      supervisorId: apple._id,
      date: "2025-11-11"
    });
    
    const nov12_2025 = await TellerReport.find({
      supervisorId: apple._id,
      date: "2025-11-12"
    });
    
    console.log(`📅 November 11, 2025: ${nov11_2025.length} reports`);
    console.log(`📅 November 12, 2025: ${nov12_2025.length} reports`);
    
    // Let's also check for any other date patterns
    const allAppleReports = await TellerReport.find({ supervisorId: apple._id });
    const datePatterns = {};
    
    allAppleReports.forEach(report => {
      const dateStr = report.date;
      datePatterns[dateStr] = (datePatterns[dateStr] || 0) + 1;
    });
    
    console.log("\n📊 All Apple report date patterns:");
    Object.keys(datePatterns).sort().forEach(date => {
      console.log(`   ${date}: ${datePatterns[date]} reports`);
    });
    
    if (nov12_2025.length > 0) {
      console.log("\n⚠️ FOUND DUPLICATE November 12, 2025 reports!");
      console.log("Need to merge November 12, 2025 to November 11, 2025");
      return true; // Need fix
    } else {
      console.log("\n✅ No November 12, 2025 duplicates found");
      return false; // No fix needed
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    return null;
  } finally {
    await mongoose.disconnect();
  }
}

checkNovember2025().then(needsFix => {
  if (needsFix) {
    console.log("🔧 Run the merge script to fix duplicates");
    process.exit(1);
  } else if (needsFix === null) {
    console.log("❌ Error occurred during check");
    process.exit(2);
  } else {
    console.log("🎉 All good - no duplicates found!");
    process.exit(0);
  }
});