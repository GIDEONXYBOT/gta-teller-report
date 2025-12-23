// Direct MongoDB script to create base salary payrolls
import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./models/User.js";
import Payroll from "./models/Payroll.js";
import Capital from "./models/Capital.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/rmi_teller_report";

async function createBaseSalaries() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    console.log(`📅 Processing payrolls for ${monthStart.toLocaleDateString()} to ${monthEnd.toLocaleDateString()}`);

    // Find all users who have capital records (ever)
    const capitals = await Capital.find().lean();
    const userIds = new Set();
    
    capitals.forEach(cap => {
      if (cap.tellerId) userIds.add(cap.tellerId.toString());
      if (cap.supervisorId) userIds.add(cap.supervisorId.toString());
    });

    console.log(`👥 Found ${userIds.size} unique users with capital transactions`);

    let created = 0;
    let existing = 0;
    let errors = 0;

    for (const userId of userIds) {
      try {
        const user = await User.findById(userId).lean();
        if (!user) {
          console.log(`⚠️ User ${userId} not found, skipping`);
          continue;
        }

        // Check if payroll exists for this month
        let payroll = await Payroll.findOne({
          user: userId,
          createdAt: { $gte: monthStart, $lte: monthEnd }
        });

        if (payroll) {
          console.log(`✓ Payroll already exists for ${user.username} (${user.role})`);
          existing++;
          continue;
        }

        // Create new payroll with base salary
        payroll = new Payroll({
          user: userId,
          role: user.role,
          baseSalary: user.baseSalary || 0,
          over: 0,
          short: 0,
          deduction: 0,
          withdrawal: 0,
          totalSalary: user.baseSalary || 0
        });

        await payroll.save();
        console.log(`✅ Created payroll for ${user.username} (${user.role}) - Base: ₱${user.baseSalary || 0}`);
        created++;

      } catch (err) {
        console.error(`❌ Error processing user ${userId}:`, err.message);
        errors++;
      }
    }

    console.log("\n" + "=".repeat(50));
    console.log(`📊 Summary:`);
    console.log(`   Created: ${created}`);
    console.log(`   Already existed: ${existing}`);
    console.log(`   Errors: ${errors}`);
    console.log(`   Total processed: ${userIds.size}`);
    console.log("=".repeat(50));

    await mongoose.disconnect();
    console.log("✅ Disconnected from MongoDB");

  } catch (error) {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  }
}

createBaseSalaries();
