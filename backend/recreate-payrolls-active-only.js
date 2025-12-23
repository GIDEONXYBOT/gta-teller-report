// Recreate payrolls ONLY for users who worked (have capital OR reports) this month
import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./models/User.js";
import Payroll from "./models/Payroll.js";
import Capital from "./models/Capital.js";
import TellerReport from "./models/TellerReport.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/rmi_teller_report";

async function recreatePayrollsForActiveOnly() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    console.log(`\n📅 Processing for ${monthStart.toLocaleDateString()} to ${monthEnd.toLocaleDateString()}\n`);

    // Find all users who worked this month (either added capital OR submitted reports)
    const activeUserIds = new Set();

    // 1. Users who added capital as teller
    const capitalsAsTeller = await Capital.find({
      createdAt: { $gte: monthStart, $lte: monthEnd }
    }).distinct('tellerId');
    capitalsAsTeller.forEach(id => activeUserIds.add(id.toString()));

    // 2. Users who added capital as supervisor
    const capitalsAsSupervisor = await Capital.find({
      createdAt: { $gte: monthStart, $lte: monthEnd }
    }).distinct('supervisorId');
    capitalsAsSupervisor.forEach(id => id && activeUserIds.add(id.toString()));

    // 3. Users who submitted teller reports
    const reportsAsTeller = await TellerReport.find({
      $or: [
        { date: { $gte: monthStart, $lte: monthEnd } },
        { createdAt: { $gte: monthStart, $lte: monthEnd } }
      ]
    }).distinct('tellerId');
    reportsAsTeller.forEach(id => activeUserIds.add(id.toString()));

    console.log(`👥 Found ${activeUserIds.size} active users this month\n`);

    let created = 0;
    let updated = 0;

    for (const userId of activeUserIds) {
      const user = await User.findById(userId);
      if (!user) {
        console.log(`⚠️ User ${userId} not found, skipping`);
        continue;
      }

      // Check for teller reports (for tellers only)
      let totalOver = 0;
      let totalShort = 0;
      if (user.role === "teller") {
        const reports = await TellerReport.find({
          tellerId: userId,
          $or: [
            { date: { $gte: monthStart, $lte: monthEnd } },
            { createdAt: { $gte: monthStart, $lte: monthEnd } }
          ]
        });
        totalOver = reports.reduce((sum, r) => sum + (Number(r.over) || 0), 0);
        totalShort = reports.reduce((sum, r) => sum + (Number(r.short) || 0), 0);
      }

      // Find or create payroll
      let payroll = await Payroll.findOne({
        user: userId,
        createdAt: { $gte: monthStart, $lte: monthEnd }
      });

      if (!payroll) {
        // Create new payroll
        payroll = new Payroll({
          user: userId,
          role: user.role,
          baseSalary: user.baseSalary || 0,
          over: totalOver,
          short: totalShort,
          deduction: 0,
          withdrawal: 0
        });
        payroll.totalSalary = (payroll.baseSalary || 0) + totalOver - totalShort;
        await payroll.save();
        console.log(`✨ Created: ${user.username} (${user.role}) - Base: ₱${payroll.baseSalary}, Over: ₱${totalOver}, Total: ₱${payroll.totalSalary}`);
        created++;
      } else {
        // Update existing payroll
        payroll.over = totalOver;
        payroll.short = totalShort;
        payroll.baseSalary = user.baseSalary || 0;
        payroll.totalSalary = (payroll.baseSalary || 0) + totalOver - totalShort - (payroll.deduction || 0) - (payroll.withdrawal || 0);
        await payroll.save();
        console.log(`🔄 Updated: ${user.username} (${user.role}) - Base: ₱${payroll.baseSalary}, Over: ₱${totalOver}, Total: ₱${payroll.totalSalary}`);
        updated++;
      }
    }

    console.log("\n" + "=".repeat(50));
    console.log(`📊 Summary:`);
    console.log(`   Created: ${created}`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Total active users: ${activeUserIds.size}`);
    console.log("=".repeat(50));

    await mongoose.disconnect();
    console.log("\n✅ Disconnected from MongoDB");

  } catch (error) {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  }
}

recreatePayrollsForActiveOnly();
