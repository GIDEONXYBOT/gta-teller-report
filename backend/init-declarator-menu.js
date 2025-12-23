import mongoose from "mongoose";
import MenuPermission from "./models/MenuPermission.js";
import dotenv from "dotenv";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/rmi-teller-db";

async function initDeclaratorMenu() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Check if declarator menu already exists
    const existing = await MenuPermission.findOne({ role: "declarator" });
    
    if (existing) {
      console.log("ℹ️  Declarator menu already exists:", existing.menuItems);
      console.log("Updating to ensure all items are present...");
    }

    // Define declarator menu items
    const declaratorMenuItems = [
      'deployments',
      'settings',
      'live-map',
      'map-editor'
    ];

    // Upsert the declarator menu permission
    const result = await MenuPermission.findOneAndUpdate(
      { role: "declarator" },
      {
        role: "declarator",
        menuItems: declaratorMenuItems,
        updatedBy: "system",
        updatedAt: new Date()
      },
      { upsert: true, new: true }
    );

    console.log("✅ Declarator menu permissions initialized:");
    console.log(JSON.stringify(result, null, 2));

    process.exit(0);
  } catch (error) {
    console.error("❌ Error initializing declarator menu:", error);
    process.exit(1);
  }
}

initDeclaratorMenu();
