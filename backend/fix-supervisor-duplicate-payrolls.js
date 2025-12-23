import mongoose from "mongoose";
import User from "./models/User.js";
import Payroll from "./models/Payroll.js";

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/rmi_teller_report";

async function fixSupervisorDuplicatePayrolls() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Find all supervisors
    const supervisors = await User.find({ role: 'supervisor' }).select('_id name username').lean();
    console.log(`👥 Found ${supervisors.length} supervisors`);

    let totalDuplicatesRemoved = 0;

    for (const supervisor of supervisors) {
      console.log(`\n🔍 Checking supervisor: ${supervisor.name || supervisor.username}`);

      // Find all payroll records for this supervisor
      const payrolls = await Payroll.find({ user: supervisor._id })
        .sort({ createdAt: -1 })
        .lean();

      if (payrolls.length <= 1) {
        console.log(`  ✅ No duplicates found (${payrolls.length} record)`);
        continue;
      }

      console.log(`  📊 Found ${payrolls.length} payroll records`);

      // Group by date to find duplicates
      const payrollsByDate = {};
      payrolls.forEach(payroll => {
        const date = payroll.date || payroll.createdAt.toISOString().split('T')[0];
        if (!payrollsByDate[date]) {
          payrollsByDate[date] = [];
        }
        payrollsByDate[date].push(payroll);
      });

      // Remove duplicates, keeping only the most recent one for each date
      for (const [date, datePayrolls] of Object.entries(payrollsByDate)) {
        if (datePayrolls.length > 1) {
          console.log(`  🗑️ Found ${datePayrolls.length} duplicates for date ${date}`);

          // Sort by createdAt descending (most recent first)
          datePayrolls.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

          // Keep the first one (most recent), delete the rest
          const toKeep = datePayrolls[0];
          const toDelete = datePayrolls.slice(1);

          console.log(`    ✅ Keeping: ${toKeep._id} (created: ${toKeep.createdAt})`);
          for (const duplicate of toDelete) {
            console.log(`    🗑️ Deleting: ${duplicate._id} (created: ${duplicate.createdAt})`);
            await Payroll.findByIdAndDelete(duplicate._id);
            totalDuplicatesRemoved++;
          }
        }
      }
    }

    console.log(`\n✅ Cleanup complete! Removed ${totalDuplicatesRemoved} duplicate payroll records for supervisors.`);

  } catch (err) {
    console.error("❌ Error fixing supervisor duplicate payrolls:", err);
  } finally {
    await mongoose.disconnect();
    console.log("📪 Disconnected from MongoDB");
  }
}

fixSupervisorDuplicatePayrolls();