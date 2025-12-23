import mongoose from "mongoose";
import User from "./models/User.js";
import bcrypt from "bcryptjs";

const MONGO_URI = "mongodb://localhost:27017/rmi-teller-report";

mongoose.connect(MONGO_URI)
  .then(async () => {
    console.log("✅ Connected to Local MongoDB\n");
    
    const hashedPassword = await bcrypt.hash("password123", 10);
    const now = new Date();
    
    // Create Apple as a supervisor with proper base salary
    const apple = new User({
      name: "Apple",
      username: "apple",
      email: "apple@rmi.com",
      password: hashedPassword,
      role: "supervisor",
      status: "approved",
      baseSalary: 600, // Supervisor base salary
      totalWorkDays: 0,
      lastWorked: now,
      createdAt: now,
      updatedAt: now,
    });
    
    try {
      await apple.save();
      console.log(`✅ Successfully created Apple (Supervisor)`);
      console.log(`   Name: ${apple.name}`);
      console.log(`   Role: ${apple.role}`);
      console.log(`   Base Salary: ₱${apple.baseSalary}`);
      console.log(`   ID: ${apple._id}`);
    } catch (err) {
      console.error("❌ Failed to create Apple:", err.message);
    }
    
    // Now check Shane's base salary
    const shane = await User.findOne({ name: "Shane" }).lean();
    if (shane) {
      console.log(`\n✅ Shane found:`);
      console.log(`   Name: ${shane.name}`);
      console.log(`   Role: ${shane.role}`);
      console.log(`   Base Salary: ₱${shane.baseSalary || 0}`);
      console.log(`   ID: ${shane._id}`);
      
      if (!shane.baseSalary || shane.baseSalary === 0) {
        console.log(`   ⚠️  Shane has NO base salary set!`);
      }
    }
    
    mongoose.connection.close();
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Connection failed:", err.message);
    process.exit(1);
  });
