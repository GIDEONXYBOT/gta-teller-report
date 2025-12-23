import mongoose from "mongoose";
import User from "./models/User.js";
import Payroll from "./models/Payroll.js";

const MONGO_URI = "mongodb://localhost:27017/rmi-teller-report";

mongoose.connect(MONGO_URI)
  .then(async () => {
    console.log("✅ Connected to Local MongoDB\n");
    
    // Find Shane and Apple
    const tellers = await User.find({ 
      name: { $in: ["Shane", "Apple"] } 
    }).lean();
    
    if (tellers.length === 0) {
      console.log("❌ Shane or Apple not found");
      mongoose.connection.close();
      process.exit(0);
    }
    
    console.log("👥 Found tellers:", tellers.map(t => ({ name: t.name, _id: t._id, role: t.role })));
    console.log("\n");
    
    // Get their payroll records
    for (const teller of tellers) {
      console.log(`\n📊 ${teller.name}'s Payroll Records:`);
      console.log("=" .repeat(60));
      
      const payrolls = await Payroll.find({ 
        tellerId: teller._id 
      }).sort({ date: -1 }).lean();
      
      if (payrolls.length === 0) {
        console.log("  ❌ No payroll records found");
        continue;
      }
      
      console.log(`  Total records: ${payrolls.length}\n`);
      
      // Show last 5 records
      payrolls.slice(0, 5).forEach((p, idx) => {
        console.log(`  ${idx + 1}. Date: ${p.date}`);
        console.log(`     baseSalary: ₱${p.baseSalary || 0}`);
        console.log(`     totalIncome: ₱${p.totalIncome || 0}`);
        console.log(`     totalDeductions: ₱${p.totalDeductions || 0}`);
        console.log(`     netPay: ₱${p.netPay || 0}`);
        console.log();
      });
      
      // Find records with 0 baseSalary
      const zeroBaseSalary = payrolls.filter(p => p.baseSalary === 0 || !p.baseSalary);
      if (zeroBaseSalary.length > 0) {
        console.log(`  ⚠️  Found ${zeroBaseSalary.length} records with ZERO baseSalary`);
      }
    }
    
    mongoose.connection.close();
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Connection failed:", err.message);
    process.exit(1);
  });
