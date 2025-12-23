import mongoose from "mongoose";
import User from "./models/User.js";
import SystemSettings from "./models/SystemSettings.js";

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/rmi_teller_report";

async function syncAllBaseSalaries() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Get system settings
    const settings = await SystemSettings.findOne();
    if (!settings || !settings.baseSalary) {
      console.log("❌ No system settings found. Please set base salaries in Admin Settings first.");
      process.exit(0);
    }

    console.log("📊 System Base Salaries:");
    console.log(`  Admin: ₱${settings.baseSalary.admin}`);
    console.log(`  Supervisor: ₱${settings.baseSalary.supervisor}`);
    console.log(`  Teller: ₱${settings.baseSalary.teller}`);
    console.log("");

    // Update all users based on their role
    const adminResult = await User.updateMany(
      { role: "admin" },
      { baseSalary: Number(settings.baseSalary.admin) }
    );
    console.log(`✅ Updated ${adminResult.modifiedCount} admin users to ₱${settings.baseSalary.admin}`);

    const supervisorResult = await User.updateMany(
      { role: "supervisor" },
      { baseSalary: Number(settings.baseSalary.supervisor) }
    );
    console.log(`✅ Updated ${supervisorResult.modifiedCount} supervisor users to ₱${settings.baseSalary.supervisor}`);

    const tellerResult = await User.updateMany(
      { role: "teller" },
      { baseSalary: Number(settings.baseSalary.teller) }
    );
    console.log(`✅ Updated ${tellerResult.modifiedCount} teller users to ₱${settings.baseSalary.teller}`);

    console.log("");
    console.log("🎉 All users' base salaries synced successfully!");

    // Show sample of updated users
    const users = await User.find().select("name username role baseSalary").limit(10);
    console.log("\n📋 Sample of updated users:");
    users.forEach(u => {
      console.log(`  ${u.name} (${u.username}) - ${u.role}: ₱${u.baseSalary}`);
    });

    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
}

syncAllBaseSalaries();
