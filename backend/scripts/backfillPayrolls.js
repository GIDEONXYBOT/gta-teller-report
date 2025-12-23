#!/usr/bin/env node
import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import Payroll from "../models/Payroll.js";
import User from "../models/User.js";

async function main() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB for payroll backfill\n");

    // Optional date range via env (START_DATE and END_DATE) or process all
    const startDate = process.env.START_DATE ? new Date(process.env.START_DATE) : null;
    const endDate = process.env.END_DATE ? new Date(process.env.END_DATE) : null;

    const filter = {};
    if (startDate && endDate) filter.createdAt = { $gte: startDate, $lte: endDate };

    const payrolls = await Payroll.find(filter).lean();
    console.log(`🔎 Found ${payrolls.length} payroll(s) to process`);

    let processed = 0;
    for (const p of payrolls) {
      try {
        const payroll = await Payroll.findById(p._id);
        if (!payroll) continue;

        // Ensure baseSalary is present — fallback to user's baseSalary
        if (!payroll.baseSalary || payroll.baseSalary === 0) {
          const u = await User.findById(payroll.user).lean();
          payroll.baseSalary = u ? (u.baseSalary || 0) : 0;
        }

        const shortTerms = payroll.shortPaymentTerms || 1;
        const weeklyShort = Number(payroll.short || 0) / shortTerms;

        payroll.totalSalary = (payroll.baseSalary || 0) +
                              Number(payroll.over || 0) -
                              Number(weeklyShort || 0) -
                              (payroll.deduction || 0) -
                              (payroll.withdrawal || 0);

        await payroll.save();
        processed++;
        if (processed % 50 === 0) console.log(`  ✅ Processed ${processed} payrolls...`);
      } catch (err) {
        console.warn("⚠️ Failed to process payroll", p._id, err.message);
      }
    }

    console.log(`\n✅ Finished. Processed ${processed}/${payrolls.length} payrolls`);
    process.exit(0);
  } catch (err) {
    console.error("❌ Backfill failed:", err);
    process.exit(1);
  }
}

main();
