require('./models/Payroll.js');
require('mongoose').connect('mongodb://localhost/rmi-teller-report').then(async () => {
  const Payroll = require('./models/Payroll.js');
  const today = new Date();
  const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
  const dayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
  const payrolls = await Payroll.find({ createdAt: { $gte: dayStart, $lte: dayEnd } }).populate('user').lean();
  console.log('Payrolls for today:', payrolls.map(p => ({
    user: (p.user && p.user.name) ? p.user.name : (p.user && p.user.username) ? p.user.username : 'Unknown',
    payrollId: p._id,
    role: p.role,
    baseSalary: p.baseSalary,
    totalSalary: p.totalSalary,
    createdAt: p.createdAt
  })));
  process.exit();
});