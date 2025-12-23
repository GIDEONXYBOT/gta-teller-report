import mongoose from 'mongoose';
import Payroll from './models/Payroll.js';
import User from './models/User.js';

async function checkAllPayrolls() {
  try {
    await mongoose.connect('mongodb://localhost:27017/rmi_teller_report');

    // Get all payrolls with user info
    const payrolls = await Payroll.find({})
      .populate('user', 'name username role')
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    console.log('Recent payrolls:');
    payrolls.forEach((p, i) => {
      const user = p.user || {};
      console.log(`${i+1}. ${user.name || user.username} (${user.role}) - Date: ${p.date} - Total: ${p.totalSalary} - Created: ${p.createdAt}`);
    });

    // Check for duplicates by user and date
    const duplicates = await Payroll.aggregate([
      {
        $group: {
          _id: { user: '$user', date: '$date' },
          count: { $sum: 1 },
          payrolls: { $push: { _id: '$_id', createdAt: '$createdAt', totalSalary: '$totalSalary' } }
        }
      },
      {
        $match: { count: { $gt: 1 } }
      }
    ]);

    console.log(`\nFound ${duplicates.length} duplicate groups:`);
    for (const dup of duplicates) {
      console.log(`User ${dup._id.user} on date ${dup._id.date}: ${dup.count} payrolls`);
      dup.payrolls.forEach(p => {
        console.log(`  - ${p._id}: ${p.totalSalary} (${p.createdAt})`);
      });
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
  }
}

checkAllPayrolls();