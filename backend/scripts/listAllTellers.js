import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../models/User.js";

dotenv.config();

const listTellers = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    const tellers = await User.find({ role: "teller" }).lean();
    
    console.log(`\n📋 Found ${tellers.length} tellers:\n`);
    
    tellers.forEach((teller, index) => {
      console.log(`${index + 1}. ${teller.name || teller.username}`);
      console.log(`   ID: ${teller._id}`);
      console.log(`   Supervisor: ${teller.supervisorId || 'None'}`);
      console.log(`   Created: ${teller.createdAt || 'Unknown'}\n`);
    });

    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
};

listTellers();
