import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function checkSystemData() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    
    // Check all payrolls
    const payrolls = await mongoose.connection.collection('payrolls').find({}).sort({createdAt: -1}).limit(10).toArray();
    console.log('📊 Latest 10 Payrolls in system:');
    if (payrolls.length === 0) {
      console.log('   ❌ No payrolls found');
    } else {
      payrolls.forEach(p => {
        const date = new Date(p.createdAt).toISOString().split('T')[0];
        console.log(`   ${date} | Base: ₱${p.baseSalary} | Over: ₱${p.over} | Total: ₱${p.totalSalary}`);
      });
    }

    // Check all teller reports
    const reports = await mongoose.connection.collection('tellerReports').find({}).sort({createdAt: -1}).limit(10).toArray();
    console.log('\n📋 Latest 10 Teller Reports in system:');
    if (reports.length === 0) {
      console.log('   ❌ No teller reports found');
    } else {
      reports.forEach(r => {
        console.log(`   ${r.date} | Over: ₱${r.over} | Short: ₱${r.short}`);
      });
    }

    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err);
  }
}

checkSystemData();
