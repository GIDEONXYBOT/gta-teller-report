import mongoose from "mongoose";
import User from "./models/User.js";
import TellerReport from "./models/TellerReport.js";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/rmi_teller_report";

async function checkSupervisorSync() {
  try {
    console.log("🔌 Connecting to MongoDB Atlas...");
    console.log("🌐 URI:", MONGO_URI.replace(/\/\/[^:]+:[^@]+@/, "//***:***@")); // Hide credentials
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB Atlas successfully");

    console.log("\n🔍 CHECKING SUPERVISOR SYNCHRONIZATION ISSUES...");
    console.log("=" .repeat(60));

    // Find all tellers
    const tellers = await User.find({ role: 'teller' }).lean();
    console.log(`\n👥 Found ${tellers.length} tellers`);

    // Find tellers with missing supervisorId
    const tellersWithoutSupervisor = tellers.filter(teller => !teller.supervisorId);
    console.log(`\n❌ Tellers without supervisorId: ${tellersWithoutSupervisor.length}`);

    for (const teller of tellersWithoutSupervisor) {
      console.log(`\n📋 TELLER: ${teller.name} (${teller._id})`);
      console.log(`   • Status: ${teller.status}`);
      console.log(`   • Role: ${teller.role}`);
      console.log(`   • SupervisorId: ${teller.supervisorId || 'MISSING'}`);

      // Check if this teller has any reports
      const reportCount = await TellerReport.countDocuments({ tellerId: teller._id });
      console.log(`   • Total Reports: ${reportCount}`);

      if (reportCount > 0) {
        // Get recent reports to see if they have supervisor info
        const recentReports = await TellerReport.find({ tellerId: teller._id })
          .sort({ createdAt: -1 })
          .limit(3)
          .lean();

        console.log(`   • Recent Reports:`);
        recentReports.forEach((report, index) => {
          console.log(`     ${index + 1}. ${report.date} - Supervisor: ${report.supervisorName || 'Missing'} (ID: ${report.supervisorId || 'Missing'})`);
        });

        // Check if any reports have supervisor info
        const reportsWithSupervisor = recentReports.filter(r => r.supervisorId || r.supervisorName);
        if (reportsWithSupervisor.length > 0) {
          console.log(`   ⚠️ SYNC ISSUE: Teller has reports with supervisor info but user record missing supervisorId`);
          
          // Find most common supervisor from reports
          const supervisorCounts = {};
          recentReports.forEach(report => {
            if (report.supervisorId) {
              supervisorCounts[report.supervisorId] = (supervisorCounts[report.supervisorId] || 0) + 1;
            }
          });
          
          if (Object.keys(supervisorCounts).length > 0) {
            const mostCommonSupervisorId = Object.keys(supervisorCounts).reduce((a, b) => 
              supervisorCounts[a] > supervisorCounts[b] ? a : b
            );
            
            const supervisor = await User.findById(mostCommonSupervisorId).lean();
            console.log(`   💡 SUGGESTED FIX: Assign supervisorId: ${mostCommonSupervisorId} (${supervisor?.name})`);
            console.log(`   💡 SQL: UPDATE users SET supervisorId = '${mostCommonSupervisorId}' WHERE _id = '${teller._id}'`);
          }
        } else {
          console.log(`   ℹ️ No supervisor info in reports either - needs manual assignment`);
        }
      } else {
        console.log(`   ℹ️ No reports submitted yet`);
      }
    }

    console.log(`\n📊 SUMMARY:`);
    console.log(`• Total Tellers: ${tellers.length}`);
    console.log(`• Missing SupervisorId: ${tellersWithoutSupervisor.length}`);
    console.log(`• Percentage: ${((tellersWithoutSupervisor.length / tellers.length) * 100).toFixed(1)}%`);

    if (tellersWithoutSupervisor.length > 0) {
      console.log(`\n🔧 RECOMMENDED ACTIONS:`);
      console.log(`1. Review supervisor assignments in admin panel`);
      console.log(`2. Run supervisor sync script to update user records`);
      console.log(`3. Ensure mobile validation allows submissions despite missing supervisorId`);
      console.log(`4. Update backend to handle supervisor assignment dynamically`);
    }

  } catch (error) {
    console.error("❌ Error checking supervisor sync:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\n🔌 Disconnected from MongoDB");
  }
}

checkSupervisorSync();