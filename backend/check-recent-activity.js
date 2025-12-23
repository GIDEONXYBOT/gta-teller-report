import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./models/User.js";
import Payroll from "./models/Payroll.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/rmi_teller_report";

async function checkRecentActivity() {
  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000
    });
    console.log("✅ Connected to MongoDB");

    // Check for recent payrolls (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentPayrolls = await Payroll.find({
      createdAt: { $gte: sevenDaysAgo }
    }).populate('user', 'username name role baseSalary').sort({ createdAt: -1 }).limit(20).lean();

    console.log(`\n📋 Recent payrolls (last 7 days, ${recentPayrolls.length} found):`);
    recentPayrolls.forEach(p => {
      const date = new Date(p.createdAt).toISOString().split('T')[0];
      const userName = p.user ? (p.user.name || p.user.username) : 'Unknown';
      const userBaseSalary = p.user ? (p.user.baseSalary || 0) : 0;
      const payrollBaseSalary = p.baseSalary || 0;
      const status = payrollBaseSalary === 0 ? '❌ ZERO' : '✅ OK';
      console.log(`  ${date}: ${userName} (${p.role}) - Payroll Base: ₱${payrollBaseSalary}, User Base: ₱${userBaseSalary} ${status}`);
    });

    // Check all users and their base salaries (most recent first)
    const allUsers = await User.find({}).select('username name role baseSalary createdAt').sort({ createdAt: -1 }).limit(15).lean();
    console.log(`\n👥 Most recent users (${allUsers.length} shown):`);
    allUsers.forEach(u => {
      const createdDate = new Date(u.createdAt).toISOString().split('T')[0];
      const baseSalary = u.baseSalary || 0;
      const status = baseSalary === 0 && u.role !== 'admin' && u.role !== 'super_admin' ? '❌ ZERO BASE' : '✅ OK';
      console.log(`  ${createdDate}: ${u.name || u.username} (${u.role}) - ₱${baseSalary} ${status}`);
    });

    // Check for users with zero base salary (excluding admins)
    const zeroBaseUsers = await User.find({
      $or: [
        { baseSalary: { $exists: false } },
        { baseSalary: 0 }
      ],
      role: { $nin: ['admin', 'super_admin'] }
    }).select('username name role baseSalary createdAt').lean();

    if (zeroBaseUsers.length > 0) {
      console.log(`\n🚨 CRITICAL: ${zeroBaseUsers.length} non-admin users still have baseSalary = 0:`);
      zeroBaseUsers.forEach(u => {
        const createdDate = new Date(u.createdAt).toISOString().split('T')[0];
        console.log(`  ❌ ${createdDate}: ${u.name || u.username} (${u.role}) - ₱${u.baseSalary || 0}`);
      });
    } else {
      console.log(`\n✅ All non-admin users have proper base salaries!`);
    }

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\n👋 Disconnected from MongoDB");
  }
}

checkRecentActivity();