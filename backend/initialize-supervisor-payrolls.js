import mongoose from "mongoose";
import User from "./models/User.js";
import SupervisorPayroll from "./models/SupervisorPayroll.js";

// Connect to MongoDB
async function connectDB() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/rmi_teller_report', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB connected');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    process.exit(1);
  }
}

const initializeSupervisorPayrolls = async () => {
  try {
    await connectDB();
    console.log("🔌 Connected to database");

    // Find all supervisors
    const supervisors = await User.find({ role: 'supervisor' });
    console.log(`👥 Found ${supervisors.length} supervisors`);

    let created = 0;
    let skipped = 0;

    for (const supervisor of supervisors) {
      // Check if supervisor already has a payroll record
      const existingPayroll = await SupervisorPayroll.findOne({ supervisorId: supervisor._id });

      if (existingPayroll) {
        console.log(`⏭️ Supervisor ${supervisor.name || supervisor.username} already has payroll record`);
        skipped++;
        continue;
      }

      // Create new SupervisorPayroll record
      const payroll = new SupervisorPayroll({
        supervisorId: supervisor._id,
        baseSalary: supervisor.baseSalary || 0,
        totalSalary: supervisor.baseSalary || 0, // Start with base salary
        date: new Date().toISOString().split('T')[0], // Today's date
      });

      await payroll.save();
      console.log(`✅ Created payroll record for supervisor: ${supervisor.name || supervisor.username}`);
      created++;
    }

    console.log(`\n📊 Summary:`);
    console.log(`   Created: ${created}`);
    console.log(`   Skipped: ${skipped}`);
    console.log(`   Total supervisors: ${supervisors.length}`);

  } catch (error) {
    console.error("❌ Error initializing supervisor payrolls:", error);
  } finally {
    await mongoose.connection.close();
    console.log("🔌 Database connection closed");
  }
};

// Run the script
initializeSupervisorPayrolls();