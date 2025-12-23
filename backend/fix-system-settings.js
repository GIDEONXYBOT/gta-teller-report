import mongoose from "mongoose";
import dotenv from "dotenv";
import SystemSettings from "./models/SystemSettings.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/rmi-teller";

async function fixSystemSettings() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB\n");

    const settings = await SystemSettings.findOne();

    if (!settings) {
      console.log("❌ No system settings found");
      return;
    }

    console.log("=".repeat(60));
    console.log("🔧 FIXING SYSTEM SETTINGS");
    console.log("=".repeat(60));

    console.log("\n📋 Current Structure:");
    console.log("baseSalary (singular):", settings.baseSalary);
    console.log("baseSalaries (plural):", settings.baseSalaries);

    // Add baseSalaries field with same values as baseSalary
    if (!settings.baseSalaries && settings.baseSalary) {
      console.log("\n⚠️  Adding 'baseSalaries' field for compatibility...");
      
      settings.baseSalaries = {
        teller: settings.baseSalary.teller || 450,
        supervisor: settings.baseSalary.supervisor || 500,
        supervisor_teller: settings.baseSalary.supervisor || 500,
        admin: settings.baseSalary.admin || 0,
        head_watcher: settings.baseSalary.head_watcher || 450,
        sub_watcher: settings.baseSalary.sub_watcher || 400
      };

      await settings.save();
      
      console.log("✅ Added baseSalaries field:");
      console.log("  Teller:            ₱" + settings.baseSalaries.teller);
      console.log("  Supervisor:        ₱" + settings.baseSalaries.supervisor);
      console.log("  Supervisor-Teller: ₱" + settings.baseSalaries.supervisor_teller);
      console.log("  Admin:             ₱" + settings.baseSalaries.admin);
      console.log("  Head Watcher:      ₱" + settings.baseSalaries.head_watcher);
      console.log("  Sub Watcher:       ₱" + settings.baseSalaries.sub_watcher);
    } else if (settings.baseSalaries) {
      console.log("\n✅ baseSalaries field already exists");
    }

    console.log("\n" + "=".repeat(60));
    console.log("✅ System Settings Fixed");
    console.log("=".repeat(60));

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\n👋 Disconnected from MongoDB");
  }
}

fixSystemSettings();
