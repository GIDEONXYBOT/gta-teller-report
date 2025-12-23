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
  locked: { type: Boolean, default: false },
  adjustments: [{
    delta: Number,
    reason: String,
    adminId: mongoose.Schema.Types.ObjectId,
    date: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

const Payroll = mongoose.model('Payroll', PayrollSchema);

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, required: true },
  name: String,
  baseSalary: { type: Number, default: 0 }
}, { timestamps: true });

const User = mongoose.model('User', UserSchema);

async function moveToToday() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const manila = DateTime.now().setZone('Asia/Manila');
    const todayStart = manila.startOf('day').toJSDate();
    console.log(`\n📅 Moving payrolls to today: ${manila.toFormat('yyyy-MM-dd')}`);
    console.log(`📅 Today start (Manila): ${manila.startOf('day').toFormat('yyyy-MM-dd HH:mm:ss')}`);
    console.log(`📅 Today start (UTC): ${DateTime.fromJSDate(todayStart).toUTC().toFormat('yyyy-MM-dd HH:mm:ss')}`);


    // Find users by name
    const names = ['erika jane hongoy', 'Tessa Dianne G Carolasan', 'Shane Marie quijano'];
    const users = await User.find({ name: { $in: names } });
    
    console.log(`\n👥 Found ${users.length} users:`);
    users.forEach(u => console.log(`  - ${u.name} (${u.username})`));

    if (users.length === 0) {
      console.log('❌ No users found with those names');
      return;
    }

    // Get current month range
    const monthStart = manila.startOf('month').toJSDate();
    const monthEnd = manila.endOf('month').toJSDate();

    // Find their payrolls this month
    const payrolls = await Payroll.find({
      user: { $in: users.map(u => u._id) },
      createdAt: { $gte: monthStart, $lte: monthEnd }
    }).populate('user', 'name username');

    console.log(`\n💰 Found ${payrolls.length} payrolls to update:`);
    
    for (const payroll of payrolls) {
      const oldDateManila = DateTime.fromJSDate(payroll.createdAt).setZone('Asia/Manila').toFormat('yyyy-MM-dd HH:mm:ss');
      const oldDateUTC = DateTime.fromJSDate(payroll.createdAt).toUTC().toFormat('yyyy-MM-dd HH:mm:ss');
      
      // Update to today using native MongoDB driver to bypass Mongoose timestamp protection
      await mongoose.connection.collection('payrolls').updateOne(
        { _id: payroll._id },
        { 
          $set: { 
            createdAt: todayStart,
            updatedAt: new Date()
          }
        }
      );
      
      const updated = await Payroll.findById(payroll._id);
      const newDateManila = DateTime.fromJSDate(updated.createdAt).setZone('Asia/Manila').toFormat('yyyy-MM-dd HH:mm:ss');
      const newDateUTC = DateTime.fromJSDate(updated.createdAt).toUTC().toFormat('yyyy-MM-dd HH:mm:ss');
      
      console.log(`  ✅ ${payroll.user.name}:`);
      console.log(`     Old (UTC):    ${oldDateUTC}`);
      console.log(`     Old (Manila): ${oldDateManila}`);
      console.log(`     New (UTC):    ${newDateUTC}`);
      console.log(`     New (Manila): ${newDateManila}\n`);
    }

    console.log(`\n✅ Successfully moved ${payrolls.length} payrolls to today!`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
  }
}

moveToToday();
