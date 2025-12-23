import mongoose from "mongoose";
import dotenv from "dotenv";
import SystemSettings from "./models/SystemSettings.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/rmi-teller";

async function checkSystemSettings() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB\n");

    const settings = await SystemSettings.findOne();

    if (!settings) {
      console.log("❌ No system settings found in database");
      console.log("\n💡 Creating default system settings...");
      
      const defaultSettings = new SystemSettings({
        baseSalaries: {
          teller: 450,
          supervisor: 500,
          supervisor_teller: 500,
          admin: 0,
          head_watcher: 450,
          sub_watcher: 400
        }
      });
      
      await defaultSettings.save();
      console.log("✅ Default system settings created");
      
      const newSettings = await SystemSettings.findOne();
      displaySettings(newSettings);
    } else {
      displaySettings(settings);
    }

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\n👋 Disconnected from MongoDB");
  }
}

function displaySettings(settings) {
  console.log("=".repeat(60));
  console.log("⚙️  SYSTEM SETTINGS - BASE SALARIES");
  console.log("=".repeat(60));
  
  const baseSalaries = settings.baseSalaries || {};
  
  console.log("\n💰 Current Base Salaries:");
  console.log(`  Teller:            ₱${baseSalaries.teller || 'Not Set'}`);
  console.log(`  Supervisor:        ₱${baseSalaries.supervisor || 'Not Set'}`);
  console.log(`  Supervisor-Teller: ₱${baseSalaries.supervisor_teller || 'Not Set'}`);
  console.log(`  Admin:             ₱${baseSalaries.admin || 'Not Set'}`);
  console.log(`  Head Watcher:      ₱${baseSalaries.head_watcher || 'Not Set'}`);
  console.log(`  Sub Watcher:       ₱${baseSalaries.sub_watcher || 'Not Set'}`);
  
  console.log("\n📋 Full Settings Document:");
  console.log(JSON.stringify(settings, null, 2));
  
  console.log("\n" + "=".repeat(60));
  console.log("✅ Settings Check Complete");
  console.log("=".repeat(60));
}

checkSystemSettings();
