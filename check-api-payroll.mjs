import axios from 'axios';

const API_URL = 'http://localhost:5000';

async function checkPayrollData() {
  console.log('\n=== API PAYROLL DATA CHECK ===\n');
  
  try {
    const res = await axios.get(`${API_URL}/api/payroll/all`);
    const payrolls = res.data?.payrolls || [];
    
    console.log(`Total payroll records from API: ${payrolls.length}\n`);
    
    payrolls.forEach((p, i) => {
      console.log(`${i+1}. ${p.user?.name || 'Unknown'} (${p.user?.username})`);
      console.log(`   Date: ${new Date(p.date).toLocaleDateString()}`);
      console.log(`   Base: ₱${p.baseSalary} | Over: ₱${p.over} | Short: ₱${p.short}`);
      console.log(`   Total: ₱${p.totalSalary} (Expected: ₱${p.baseSalary + p.over - p.short})`);
      console.log();
    });
    
    // Group by user
    const byUser = {};
    payrolls.forEach(p => {
      const name = p.user?.name || 'Unknown';
      if (!byUser[name]) byUser[name] = [];
      byUser[name].push(p);
    });
    
    console.log('\n=== PAYROLL BY USER ===\n');
    Object.entries(byUser).forEach(([name, records]) => {
      console.log(`${name}: ${records.length} records`);
      records.forEach((r, i) => {
        console.log(`  ${i+1}. ₱${r.totalSalary} (${new Date(r.date).toLocaleDateString()})`);
      });
    });
    
  } catch (err) {
    console.error('Error:', err.message);
  }
}

checkPayrollData();
