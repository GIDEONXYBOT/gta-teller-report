import axios from 'axios';

/**
 * UPDATE PAYROLL BASE SALARIES FOR THE 5 EMPLOYEES
 * This script calls the admin API endpoint to update payroll records
 */

const API_BASE = process.env.API_URL || 'http://localhost:5000/api';

const targetNames = ['charm', 'missy', 'jenessa', 'shane', 'apple'];
const baseSalary = 450;

// Conditional salaries for specific employees
// Apple: ₱600 (supervisor, sometimes works as teller)
const conditionalSalaries = {
  apple: 600  // Supervisor base salary (primary role)
};

(async () => {
  console.log('\n🔧 UPDATING PAYROLL BASE SALARIES\n');
  console.log(`Target employees: ${targetNames.join(', ')}`);
  console.log(`Base salary: ₱${baseSalary}`);
  console.log(`Conditional salaries: ${JSON.stringify(conditionalSalaries)}\n`);

  try {
    const response = await axios.post(
      `${API_BASE}/admin/fix-payroll-base-salaries`,
      {
        targetNames,
        baseSalary,
        conditionalSalaries
      },
      {
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    const data = response.data;

    if (data.success) {
      console.log(`✅ ${data.message}\n`);
      console.log(`📊 Summary:`);
      console.log(`   Payroll records updated: ${data.updated}`);
      console.log(`   User records updated: ${data.usersUpdated}\n`);

      if (data.details && data.details.length > 0) {
        console.log(`📋 Updated payroll records:\n`);
        data.details.forEach(detail => {
          console.log(`✅ ${detail.employee}`);
          console.log(`   📅 Date: ${detail.date || 'N/A'}`);
          console.log(`   💰 Base: ₱${detail.baseSalaryBefore} → ₱${detail.baseSalaryAfter}\n`);
        });
      }
    } else {
      console.log(`⚠️  ${data.message}`);
    }

  } catch (err) {
    if (err.response) {
      console.error(`❌ Error: ${err.response.data?.error || err.message}`);
    } else if (err.code === 'ECONNREFUSED') {
      console.error(`❌ Connection refused. Make sure the server is running at ${API_BASE}`);
    } else {
      console.error(`❌ Error: ${err.message}`);
    }
    process.exit(1);
  }

  process.exit(0);
})();
