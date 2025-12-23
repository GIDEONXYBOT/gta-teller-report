import mongoose from "mongoose";
import dotenv from "dotenv";
import TellerReport from "./models/TellerReport.js";
import Payroll from "./models/Payroll.js";
import User from "./models/User.js";
import SystemSettings from "./models/SystemSettings.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/rmi-teller";

async function fixTellerBaseSalaries() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Get system settings for default base salaries
    const settings = await SystemSettings.findOne();
    const defaultBaseSalaries = {
      teller: settings?.baseSalaries?.teller || settings?.baseSalary?.teller || 450,
      supervisor: settings?.baseSalaries?.supervisor || settings?.baseSalary?.supervisor || 600,
      supervisor_teller: settings?.baseSalaries?.supervisor_teller || settings?.baseSalary?.supervisor || 600,
      admin: settings?.baseSalaries?.admin || settings?.baseSalary?.admin || 0,
      head_watcher: settings?.baseSalaries?.head_watcher || settings?.baseSalary?.head_watcher || 450,
      sub_watcher: settings?.baseSalaries?.sub_watcher || settings?.baseSalary?.sub_watcher || 400,
    };

    console.log("\n📋 Default Base Salaries:", defaultBaseSalaries);

    // Get all teller reports grouped by date
    const reports = await TellerReport.find({})
      .populate("tellerId", "username name role baseSalary")
      .sort({ createdAt: -1 })
      .lean();

    console.log(`\n📊 Found ${reports.length} teller reports`);

    // Group reports by date and teller
    const reportsByDateAndTeller = {};
    
    reports.forEach(report => {
      if (!report.tellerId) return;
      
      const date = new Date(report.createdAt).toISOString().split('T')[0];
      const tellerId = report.tellerId._id.toString();
      
      if (!reportsByDateAndTeller[date]) {
        reportsByDateAndTeller[date] = {};
      }
      
      if (!reportsByDateAndTeller[date][tellerId]) {
        reportsByDateAndTeller[date][tellerId] = {
          teller: report.tellerId,
          reports: []
        };
      }
      
      reportsByDateAndTeller[date][tellerId].reports.push(report);
    });

    console.log(`\n📅 Processing ${Object.keys(reportsByDateAndTeller).length} unique dates`);

    let updatedCount = 0;
    let skippedCount = 0;
    let createdCount = 0;

    // Process each date
    for (const [date, tellers] of Object.entries(reportsByDateAndTeller)) {
      console.log(`\n📆 Checking date: ${date}`);
      
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      // Process each teller for this date
      for (const [tellerId, data] of Object.entries(tellers)) {
        const teller = data.teller;
        const tellerName = teller.name || teller.username;
        
        // Find payroll for this teller on this date
        let payroll = await Payroll.findOne({
          user: tellerId,
          createdAt: {
            $gte: startOfDay,
            $lte: endOfDay
          }
        });

        // Get the expected base salary
        const expectedBaseSalary = teller.baseSalary || defaultBaseSalaries[teller.role] || 450;

        if (!payroll) {
          // Create payroll if it doesn't exist
          console.log(`  ➕ Creating payroll for ${tellerName} with base salary: ₱${expectedBaseSalary}`);
          
          // Calculate short/over from reports
          const totalShort = data.reports.reduce((sum, r) => sum + (r.short || 0), 0);
          const totalOver = data.reports.reduce((sum, r) => sum + (r.over || 0), 0);
          
          payroll = new Payroll({
            user: tellerId,
            role: teller.role,
            baseSalary: expectedBaseSalary,
            short: totalShort,
            over: totalOver,
            totalSalary: expectedBaseSalary - totalShort + totalOver,
            daysPresent: 1,
            approved: false,
            locked: false,
            createdAt: startOfDay
          });
          
          await payroll.save();
          createdCount++;
          console.log(`  ✅ Created payroll for ${tellerName}`);
          
        } else if (payroll.baseSalary === 0 || !payroll.baseSalary) {
          // Update payroll if base salary is 0 or missing
          console.log(`  🔧 Updating ${tellerName}: Current base salary: ₱${payroll.baseSalary} → ₱${expectedBaseSalary}`);
          
          const oldTotalSalary = payroll.totalSalary;
          
          payroll.baseSalary = expectedBaseSalary;
          payroll.totalSalary = expectedBaseSalary - (payroll.short || 0) + (payroll.over || 0);
          
          // Add adjustments from existing adjustments
          if (payroll.adjustments && payroll.adjustments.length > 0) {
            const adjustmentTotal = payroll.adjustments.reduce((sum, adj) => sum + adj.delta, 0);
            payroll.totalSalary += adjustmentTotal;
          }
          
          await payroll.save();
          updatedCount++;
          console.log(`  ✅ Updated ${tellerName}: Total salary ₱${oldTotalSalary} → ₱${payroll.totalSalary}`);
          
        } else {
          // Payroll already has base salary
          console.log(`  ✓ ${tellerName} already has base salary: ₱${payroll.baseSalary}`);
          skippedCount++;
        }
      }
    }

    console.log("\n" + "=".repeat(60));
    console.log("📊 SUMMARY:");
    console.log("=".repeat(60));
    console.log(`✅ Created payrolls: ${createdCount}`);
    console.log(`🔧 Updated payrolls: ${updatedCount}`);
    console.log(`✓  Skipped (already OK): ${skippedCount}`);
    console.log(`📝 Total processed: ${createdCount + updatedCount + skippedCount}`);
    console.log("=".repeat(60));

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\n👋 Disconnected from MongoDB");
  }
}

fixTellerBaseSalaries();
