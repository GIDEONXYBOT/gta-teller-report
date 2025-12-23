import mongoose from 'mongoose';
import { DateTime } from 'luxon';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/rmi_teller_report';

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  name: String,
  role: String,
  baseSalary: { type: Number, default: 0 }
}, { timestamps: true });

const User = mongoose.model('User', UserSchema);

const TellerReportSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  over: { type: Number, default: 0 },
  short: { type: Number, default: 0 }
}, { timestamps: true });

const TellerReport = mongoose.model('TellerReport', TellerReportSchema);

const PayrollSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  role: { type: String, enum: ['admin', 'supervisor', 'supervisor_teller', 'teller'], required: true },
  baseSalary: { type: Number, default: 0 },
  over: { type: Number, default: 0 },
  short: { type: Number, default: 0 },
  deduction: { type: Number, default: 0 },
  withdrawal: { type: Number, default: 0 },
  totalSalary: { type: Number, default: 0 },
  approved: { type: Boolean, default: false },
  locked: { type: Boolean, default: false }
}, { timestamps: true });

const Payroll = mongoose.model('Payroll', PayrollSchema);

async function createPayrollsForYesterday() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const manila = DateTime.now().setZone('Asia/Manila');
    const yesterday = manila.minus({ days: 1 });
    const yesterdayStart = yesterday.startOf('day').toJSDate();
    const monthStart = yesterday.startOf('month').toJSDate();
    const monthEnd = yesterday.endOf('month').toJSDate();
    
    console.log(`\n📅 Creating payrolls for yesterday: ${yesterday.toFormat('yyyy-MM-dd')}`);

    // Find users
    const santa = await User.findOne({ name: 'Maria Santa Avellana' });
    const marebelen = await User.findOne({ name: 'Marebelen Udto' });

    if (!santa || !marebelen) {
      console.log('❌ Users not found');
      return;
    }

    console.log(`\n👥 Processing users:`);
    console.log(`  - ${santa.name} (${santa.role}) - Base: ₱${santa.baseSalary}`);
    console.log(`  - ${marebelen.name} (${marebelen.role}) - Base: ₱${marebelen.baseSalary}`);

    for (const user of [santa, marebelen]) {
      // Check if payroll already exists
      let payroll = await Payroll.findOne({
        user: user._id,
        createdAt: { $gte: monthStart, $lte: monthEnd }
      });

      // Get reports for this month
      const reports = await TellerReport.find({
        user: user._id,
        createdAt: { $gte: monthStart, $lte: monthEnd }
      });

      const totalOver = reports.reduce((sum, r) => sum + (r.over || 0), 0);
      const totalShort = reports.reduce((sum, r) => sum + (r.short || 0), 0);

      if (payroll) {
        console.log(`  ⚠️ Payroll already exists for ${user.name}, updating...`);
        
        // Update existing payroll date to yesterday
        await mongoose.connection.collection('payrolls').updateOne(
          { _id: payroll._id },
          { 
            $set: { 
              createdAt: yesterdayStart,
              over: totalOver,
              short: totalShort,
              totalSalary: user.baseSalary + totalOver - totalShort,
              updatedAt: new Date()
            }
          }
        );
      } else {
        // Create new payroll for yesterday
        await mongoose.connection.collection('payrolls').insertOne({
          user: user._id,
          role: user.role,
          baseSalary: user.baseSalary,
          over: totalOver,
          short: totalShort,
          deduction: 0,
          withdrawal: 0,
          totalSalary: user.baseSalary + totalOver - totalShort,
          approved: false,
          locked: false,
          withdrawn: false,
          adjustments: [],
          createdAt: yesterdayStart,
          updatedAt: new Date(),
          __v: 0
        });
      }

      const finalPayroll = await Payroll.findOne({
        user: user._id,
        createdAt: { $gte: monthStart, $lte: monthEnd }
      });

      const dateStr = DateTime.fromJSDate(finalPayroll.createdAt).setZone('Asia/Manila').toFormat('yyyy-MM-dd HH:mm:ss');
      console.log(`  ✅ ${user.name}:`);
      console.log(`     Date: ${dateStr}`);
      console.log(`     Base: ₱${finalPayroll.baseSalary}, Over: ₱${finalPayroll.over}, Short: ₱${finalPayroll.short}`);
      console.log(`     Total: ₱${finalPayroll.totalSalary}`);
    }

    console.log(`\n✅ Payrolls created/updated for yesterday!`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
  }
}

createPayrollsForYesterday();
