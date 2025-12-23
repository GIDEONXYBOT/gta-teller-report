import mongoose from "mongoose";
import Payroll from "./models/Payroll.js";
import User from "./models/User.js";
import TellerReport from "./models/TellerReport.js";

const MONGO_URI = "mongodb://localhost:27017/rmi-teller-report";

mongoose.connect(MONGO_URI)
  .then(async () => {
    console.log("✅ Connected to Local MongoDB\n");
    
    try {
      // Find Shane
      const shane = await User.findOne({ name: "Shane" }).lean();
      if (!shane) {
        console.log("❌ Shane not found");
        mongoose.connection.close();
        process.exit(1);
      }
      
      console.log(`📊 Testing Payroll Calculation for Shane:`);
      console.log(`   ID: ${shane._id}`);
      console.log(`   Base Salary: ₱${shane.baseSalary}\n`);
      
      // Create a test teller report for Shane
      const today = new Date().toISOString().split('T')[0];
      
      const report = new TellerReport({
        tellerId: shane._id,
        date: today,
        over: 100,
        short: 50,
        shortPaymentTerms: 1,
        deduction: 0,
        notes: "Test report"
      });
      
      await report.save();
      console.log(`✅ Created test TellerReport for Shane`);
      console.log(`   Over: ₱100`);
      console.log(`   Short: ₱50\n`);
      
      // Now manually call the payroll sync
      const startDay = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate(), 0, 0, 0, 0);
      const endDay = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate(), 23, 59, 59, 999);
      
      const reports = await TellerReport.find({
        tellerId: shane._id,
        createdAt: { $gte: startDay, $lte: endDay }
      }).lean();
      
      console.log(`📋 Found ${reports.length} reports for today`);
      
      const totalOver = reports.reduce((sum, r) => sum + (Number(r.over) || 0), 0);
      const totalShort = reports.reduce((sum, r) => {
        const shortAmount = Number(r.short) || 0;
        const terms = Number(r.shortPaymentTerms) || 1;
        return sum + (shortAmount / terms);
      }, 0);
      
      const daysWorked = reports.length;
      const accumulatedBase = daysWorked * (shane.baseSalary || 0);
      
      console.log(`\n💰 Calculations:`);
      console.log(`   Days Worked: ${daysWorked}`);
      console.log(`   Base Salary per day: ₱${shane.baseSalary}`);
      console.log(`   Accumulated Base: ${daysWorked} × ₱${shane.baseSalary} = ₱${accumulatedBase}`);
      console.log(`   Total Over: ₱${totalOver}`);
      console.log(`   Total Short: ₱${totalShort}\n`);
      
      // Calculate total using the same formula as backend
      const totalSalary = accumulatedBase + totalOver - totalShort;
      
      console.log(`📊 Total Payroll Calculation:`);
      console.log(`   Formula: baseSalary + over - short`);
      console.log(`   = ₱${accumulatedBase} + ₱${totalOver} - ₱${totalShort}`);
      console.log(`   = ₱${totalSalary}\n`);
      
      // Create payroll entry
      const payroll = new Payroll({
        user: shane._id,
        role: shane.role,
        baseSalary: accumulatedBase,
        over: totalOver,
        short: totalShort,
        deduction: 0,
        withdrawal: 0,
        daysPresent: daysWorked,
        date: today,
        totalSalary: totalSalary
      });
      
      await payroll.save();
      console.log(`✅ Created Payroll Entry:`);
      console.log(`   ID: ${payroll._id}`);
      console.log(`   Total Salary: ₱${payroll.totalSalary}`);
      
      // Verify by fetching
      const saved = await Payroll.findById(payroll._id).lean();
      console.log(`\n✅ Verified saved payroll:`);
      console.log(`   baseSalary: ₱${saved.baseSalary}`);
      console.log(`   over: ₱${saved.over}`);
      console.log(`   short: ₱${saved.short}`);
      console.log(`   totalSalary: ₱${saved.totalSalary}`);
      
      mongoose.connection.close();
      process.exit(0);
    } catch (err) {
      console.error("❌ Failed:", err.message);
      mongoose.connection.close();
      process.exit(1);
    }
  })
  .catch((err) => {
    console.error("❌ Connection failed:", err.message);
    process.exit(1);
  });
