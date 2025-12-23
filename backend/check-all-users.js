import mongoose from "mongoose";
import User from "./models/User.js";

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/rmi-teller";

mongoose.connect(MONGO_URI)
  .then(async () => {
    console.log("✅ Connected to MongoDB\n");
    
    // Get all roles and statuses
    const allUsers = await User.find().select("name username role status").lean();
    
    console.log(`📊 Total users: ${allUsers.length}\n`);
    
    // Group by role
    const byRole = {};
    allUsers.forEach(u => {
      const role = u.role || 'unknown';
      byRole[role] = (byRole[role] || 0) + 1;
    });
    
    console.log("👥 Users by role:");
    Object.entries(byRole).forEach(([role, count]) => {
      console.log(`  - ${role}: ${count}`);
    });
    
    // Group by status
    const byStatus = {};
    allUsers.forEach(u => {
      const status = u.status || 'no-status';
      byStatus[status] = (byStatus[status] || 0) + 1;
    });
    
    console.log("\n✅ Users by status:");
    Object.entries(byStatus).forEach(([status, count]) => {
      console.log(`  - ${status}: ${count}`);
    });
    
    // Show some samples
    const tellers = allUsers.filter(u => u.role === 'teller' || u.role === 'supervisor_teller');
    console.log(`\n📋 Sample tellers (first 5):`);
    tellers.slice(0, 5).forEach(t => {
      console.log(`  - ${t.name || t.username} | Role: ${t.role} | Status: ${t.status}`);
    });
    
    mongoose.connection.close();
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Connection failed:", err.message);
    process.exit(1);
  });
