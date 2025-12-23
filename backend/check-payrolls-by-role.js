import mongoose from 'mongoose';
import Payroll from './models/Payroll.js';

async function checkPayrollsByRole() {
  try {
    await mongoose.connect('mongodb://localhost:27017/rmi-teller-report');

    const payrolls = await Payroll.find({})
      .populate('user', 'name username role')
      .lean();

    const byRole = {};
    payrolls.forEach(p => {
      const role = p.user?.role || 'unknown';
      if (!byRole[role]) {
        byRole[role] = [];
      }
      byRole[role].push(p);
    });

    console.log('Payrolls by role:');
    for (const [role, rolePayrolls] of Object.entries(byRole)) {
      console.log(`${role}: ${rolePayrolls.length} payrolls`);
      if (role === 'supervisor' || role === 'supervisor_teller') {
        rolePayrolls.forEach(p => {
          console.log(`  - ${p.user?.name || p.user?.username}: ${p.date || p.createdAt}, Base: ₱${p.baseSalary}, Total: ₱${p.totalSalary}`);
        });
      }
    }

    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err);
  }
}

checkPayrollsByRole();