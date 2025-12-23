import mongoose from 'mongoose';
import User from './models/User.js';
import Payroll from './models/Payroll.js';
import { computeTotalSalary } from './lib/payrollCalc.js';
import bcrypt from 'bcryptjs';

(async () => {
  // Connect to Cloud Atlas production database
  const CLOUD_ATLAS_URI = 'mongodb+srv://rmi_admin:rmi1234@rmi-teller-report.fphrmaw.mongodb.net/rmi?retryWrites=true&w=majority&connectTimeoutMS=30000&socketTimeoutMS=30000';
  
  try {
    await mongoose.connect(CLOUD_ATLAS_URI);
    console.log('\n✅ Connected to Cloud Atlas!\n');
  } catch (err) {
    console.error('❌ Failed to connect to Cloud Atlas:', err.message);
    process.exit(1);
  }
  
  console.log('=== Creating Shane Marie Quijano in PRODUCTION ===\n');
  
  // Check if user already exists
  let shaneMarie = await User.findOne({ $or: [{ username: '017.marie' }, { name: /shane.*marie/i }] });
  
  if (shaneMarie) {
    console.log(`✅ Found existing user: ${shaneMarie.name}`);
  } else {
    // Create new user
    const hashedPassword = await bcrypt.hash('password123', 10);
    shaneMarie = new User({
      name: 'Shane Marie Quijano',
      username: '017.marie',
      employeeId: '017.marie',
      email: '017.marie@rmi.com',
      password: hashedPassword,
      role: 'teller',
      status: 'approved',
      baseSalary: 450,
      totalWorkDays: 0,
      lastWorked: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    await shaneMarie.save();
    console.log(`✅ Created new user: ${shaneMarie.name}`);
  }
  
  // Delete existing payroll records for this user (if any)
  const deletedCount = await Payroll.deleteMany({ user: shaneMarie._id });
  console.log(`✅ Cleared ${deletedCount.deletedCount} existing payroll records\n`);
  
  // Create the 3 payroll records
  const payrollData = [
    {
      date: new Date('2025-11-28'),
      baseSalary: 450,
      over: 373,
      short: 0,
      daysPresent: 1,
      description: '11/28/2025'
    },
    {
      date: new Date('2025-11-29'),
      baseSalary: 450,
      over: 174,
      short: 0,
      daysPresent: 1,
      description: '11/29/2025'
    },
    {
      date: new Date('2025-12-03'),
      baseSalary: 450,
      over: 0,
      short: 0,
      daysPresent: 1,
      description: '12/3/2025 (no report yet)'
    }
  ];
  
  for (const data of payrollData) {
    const totalSalary = computeTotalSalary({
      baseSalary: data.baseSalary,
      over: data.over,
      short: data.short,
      deduction: 0,
      withdrawal: 0,
      shortIsInstallment: true
    }, { period: 'daily' });
    
    const payroll = new Payroll({
      user: shaneMarie._id,
      role: shaneMarie.role,
      baseSalary: data.baseSalary,
      over: data.over,
      short: data.short,
      daysPresent: data.daysPresent,
      totalSalary: totalSalary,
      deduction: 0,
      withdrawal: 0,
      date: data.date,
      approved: false,
      locked: false,
      note: data.description,
      withdrawn: false,
      adjustments: []
    });
    
    await payroll.save();
    console.log(`✅ ${data.description}: Base ₱${data.baseSalary} + Over ₱${data.over} = Total ₱${totalSalary}`);
  }
  
  console.log(`\n✅ Successfully created Shane Marie Quijano with 3 payroll records in PRODUCTION\n`);
  
  process.exit(0);
})().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
