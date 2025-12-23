import mongoose from 'mongoose';
import { ensureBaseSalaryForActiveUsers } from './utils/ensureBaseSalary.js';

async function testPayrollCreation() {
  try {
    // Connect to local database for testing
    await mongoose.connect('mongodb://localhost:27017/rmi_teller_report');

    console.log('Testing automatic payroll creation...');
    await ensureBaseSalaryForActiveUsers();

    console.log('✅ Payroll creation test completed');
    await mongoose.disconnect();
  } catch (e) {
    console.error('❌ Error:', e.message);
  }
}

testPayrollCreation();