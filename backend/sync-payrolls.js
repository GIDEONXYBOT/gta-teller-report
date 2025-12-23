// Sync all payrolls with current month's teller reports
import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./models/User.js";
import Payroll from "./models/Payroll.js";
import TellerReport from "./models/TellerReport.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/rmi_teller_report";

async function syncPayrolls() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    console.log(`📅 Syncing payrolls for ${start.toLocaleDateString()} to ${end.toLocaleDateString()}\n`);

    const users = await User.find({ role: { $in: ["teller", "supervisor", "supervisor_teller"] } }).lean();
    let processed = 0;
    let errors = 0;

    for (const u of users) {
      try {
        // Sum reports for tellers only; supervisors don't accumulate over/short
        let totalOver = 0;
        let totalShort = 0;
        if (u.role === "teller") {
          const reports = await TellerReport.find({
            tellerId: u._id,
            $or: [
              { date: { $gte: start, $lte: end } },
              { createdAt: { $gte: start, $lte: end } }
            ]
          }).lean();
          totalOver = reports.reduce((sum, r) => sum + (Number(r.over) || 0), 0);
          totalShort = reports.reduce((sum, r) => sum + (Number(r.short) || 0), 0);
          
          if (reports.length > 0) {
            console.log(`📊 ${u.username}: ${reports.length} reports, Over: ₱${totalOver}, Short: ₱${totalShort}`);
          }
        }

        let payroll = await Payroll.findOne({ user: u._id, createdAt: { $gte: start, $lte: end } });
        if (!payroll) {
          payroll = new Payroll({
            user: u._id,
            role: u.role,
            baseSalary: u.baseSalary || 0,
            over: totalOver,
            short: totalShort,
            deduction: 0,
            withdrawal: 0,
          });
          console.log(`✨ Creating payroll for ${u.username}`);
        } else {
          payroll.over = totalOver;
          payroll.short = totalShort;
          if ((payroll.baseSalary || 0) !== (u.baseSalary || 0)) {
            payroll.baseSalary = u.baseSalary || 0;
          }
          if (!payroll.role && u.role) payroll.role = u.role;
          console.log(`🔄 Updating payroll for ${u.username}`);
        }

        payroll.totalSalary = (payroll.baseSalary || 0) +
                              (payroll.over || 0) -
                              (payroll.short || 0) -
                              (payroll.deduction || 0) -
                              (payroll.withdrawal || 0);
        await payroll.save();
        
        console.log(`   ✅ Total: ₱${payroll.totalSalary} (Base: ₱${payroll.baseSalary}, Over: ₱${payroll.over}, Short: ₱${payroll.short})\n`);
        processed += 1;
      } catch (e) {
        console.warn("⚠️ Sync failed for user", u._id, e?.message);
        errors += 1;
      }
    }

    console.log("=".repeat(50));
    console.log(`📊 Summary: Processed ${processed}, Errors: ${errors}`);
    console.log("=".repeat(50));

    await mongoose.disconnect();
    console.log("✅ Disconnected from MongoDB");

  } catch (err) {
    console.error("❌ sync-month-all error:", err);
    process.exit(1);
  }
}

syncPayrolls();
