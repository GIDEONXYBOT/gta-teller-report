import mongoose from 'mongoose';
import { DateTime } from 'luxon';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/rmi_teller_report';

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

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  name: String
}, { timestamps: true });

const User = mongoose.model('User', UserSchema);

async function checkPayrolls() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const names = ['erika jane hongoy', 'Tessa Dianne G Carolasan', 'Shane Marie quijano'];
    const users = await User.find({ name: { $in: names } });
    
    const payrolls = await Payroll.find({
      user: { $in: users.map(u => u._id) }
    }).populate('user', 'name').sort({ createdAt: -1 });

    console.log(`\n💰 Found ${payrolls.length} payrolls:\n`);
    
    payrolls.forEach(p => {
      const createdManila = DateTime.fromJSDate(p.createdAt).setZone('Asia/Manila');
      const createdUTC = DateTime.fromJSDate(p.createdAt).toUTC();
      const updatedManila = DateTime.fromJSDate(p.updatedAt).setZone('Asia/Manila');
      console.log(`  ${p.user.name}:`);
      console.log(`    Created (UTC):    ${createdUTC.toFormat('yyyy-MM-dd HH:mm:ss')}`);
      console.log(`    Created (Manila): ${createdManila.toFormat('yyyy-MM-dd HH:mm:ss')}`);
      console.log(`    Updated (Manila): ${updatedManila.toFormat('yyyy-MM-dd HH:mm:ss')}`);
      console.log(`    BaseSalary: ₱${p.baseSalary}, Total: ₱${p.totalSalary}\n`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
  }
}

checkPayrolls();
