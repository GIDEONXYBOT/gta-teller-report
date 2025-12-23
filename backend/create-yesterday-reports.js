import mongoose from 'mongoose';
import { DateTime } from 'luxon';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/rmi_teller_report';

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, required: true },
  name: String,
  supervisorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

const User = mongoose.model('User', UserSchema);

const TellerReportSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  supervisor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  date: { type: Date, required: true },
  systemBalance: { type: Number, default: 0 },
  actualCash: { type: Number, default: 0 },
  over: { type: Number, default: 0 },
  short: { type: Number, default: 0 },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'approved' }
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

async function createReportsAndMovePayroll() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const manila = DateTime.now().setZone('Asia/Manila');
    const yesterday = manila.minus({ days: 1 });
    const yesterdayDate = yesterday.startOf('day').toJSDate();
    
    console.log(`\n📅 Yesterday: ${yesterday.toFormat('yyyy-MM-dd')}`);

    // Find users
    const santa = await User.findOne({ name: 'Maria Santa Avellana' }).populate('supervisorId', 'name username');
    const marebelen = await User.findOne({ name: 'Marebelen Udto' }).populate('supervisorId', 'name username');
    const michelle = await User.findOne({ name: 'Michelle Ocaba' });

    if (!santa) {
      console.log('❌ Santa (Maria Santa Avellana) not found');
      return;
    }
    if (!marebelen) {
      console.log('❌ Marebelen (Marebelen Udto) not found');
      return;
    }
    if (!michelle) {
      console.log('❌ Michelle Ocaba not found');
      return;
    }

    console.log(`\n👥 Found users:`);
    console.log(`  - ${santa.name} (${santa.username}) - Role: ${santa.role}`);
    console.log(`  - ${marebelen.name} (${marebelen.username}) - Role: ${marebelen.role}`);
    console.log(`  - ${michelle.name} (${michelle.username}) - Role: ${michelle.role}`);

    // Get supervisors
    const santaSupervisor = santa.supervisorId || (await User.findOne({ role: { $in: ['supervisor', 'supervisor_teller'] } }));
    const marebelenSupervisor = marebelen.supervisorId || (await User.findOne({ role: { $in: ['supervisor', 'supervisor_teller'] } }));

    console.log(`\n📋 Creating teller reports for yesterday:`);

    // Create Santa's report (only if she's a teller)
    if (santa.role === 'teller' || santa.role === 'supervisor_teller') {
      const santaReport = new TellerReport({
        user: santa._id,
        supervisor: santaSupervisor?._id,
        date: yesterdayDate,
        systemBalance: 0,
        actualCash: 31,
        over: 31,
        short: 0,
        status: 'approved'
      });
      await santaReport.save();
      console.log(`  ✅ ${santa.name}: Over ₱31 (Supervisor: ${santaSupervisor?.name || 'None'})`);
    } else {
      console.log(`  ⚠️ ${santa.name} is ${santa.role}, creating report anyway...`);
      const santaReport = new TellerReport({
        user: santa._id,
        supervisor: santaSupervisor?._id,
        date: yesterdayDate,
        systemBalance: 0,
        actualCash: 31,
        over: 31,
        short: 0,
        status: 'approved'
      });
      await santaReport.save();
      console.log(`  ✅ ${santa.name}: Over ₱31 (Supervisor: ${santaSupervisor?.name || 'None'})`);
    }

    // Create Marebelen's report
    const marebelenReport = new TellerReport({
      user: marebelen._id,
      supervisor: marebelenSupervisor?._id,
      date: yesterdayDate,
      systemBalance: 0,
      actualCash: 62,
      over: 62,
      short: 0,
      status: 'approved'
    });
    await marebelenReport.save();
    console.log(`  ✅ ${marebelen.name}: Over ₱62 (Supervisor: ${marebelenSupervisor?.name || 'None'})`);

    // Move Michelle's payroll to yesterday
    console.log(`\n📅 Moving Michelle's payroll to yesterday...`);
    
    const monthStart = yesterday.startOf('month').toJSDate();
    const monthEnd = yesterday.endOf('month').toJSDate();
    
    const michellePayroll = await Payroll.findOne({
      user: michelle._id,
      createdAt: { $gte: monthStart, $lte: monthEnd }
    });

    if (michellePayroll) {
      const oldDate = DateTime.fromJSDate(michellePayroll.createdAt).setZone('Asia/Manila').toFormat('yyyy-MM-dd HH:mm:ss');
      
      await mongoose.connection.collection('payrolls').updateOne(
        { _id: michellePayroll._id },
        { 
          $set: { 
            createdAt: yesterdayDate,
            updatedAt: new Date()
          }
        }
      );
      
      const updated = await Payroll.findById(michellePayroll._id);
      const newDate = DateTime.fromJSDate(updated.createdAt).setZone('Asia/Manila').toFormat('yyyy-MM-dd HH:mm:ss');
      
      console.log(`  ✅ ${michelle.name}:`);
      console.log(`     Old: ${oldDate}`);
      console.log(`     New: ${newDate}`);
    } else {
      console.log(`  ❌ No payroll found for Michelle this month`);
    }

    // Sync payrolls with new reports
    console.log(`\n💰 Syncing payrolls...`);
    
    for (const user of [santa, marebelen]) {
      const reports = await TellerReport.find({
        user: user._id,
        createdAt: { $gte: monthStart, $lte: monthEnd }
      });

      const totalOver = reports.reduce((sum, r) => sum + (r.over || 0), 0);
      const totalShort = reports.reduce((sum, r) => sum + (r.short || 0), 0);

      const payroll = await Payroll.findOne({
        user: user._id,
        createdAt: { $gte: monthStart, $lte: monthEnd }
      });

      if (payroll) {
        payroll.over = totalOver;
        payroll.short = totalShort;
        payroll.totalSalary = payroll.baseSalary + totalOver - totalShort - (payroll.deduction || 0) - (payroll.withdrawal || 0);
        await payroll.save();
        console.log(`  ✅ ${user.name}: Base ₱${payroll.baseSalary} + Over ₱${totalOver} - Short ₱${totalShort} = Total ₱${payroll.totalSalary}`);
      } else {
        console.log(`  ⚠️ No payroll found for ${user.name} this month`);
      }
    }

    console.log(`\n✅ All done!`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
  }
}

createReportsAndMovePayroll();
