import axios from 'axios';

const response = await axios.get('http://localhost:5000/api/payroll/all');
const payrolls = response.data.payrolls;

console.log(`\n=== API PAYROLL DATA ===\n`);
console.log(`Total records: ${payrolls.length}\n`);

payrolls.forEach((p, i) => {
  console.log(`${i+1}. ${p.user.name} (${p.user.username})`);
  console.log(`   Date: ${new Date(p.date).toLocaleDateString()}`);
  console.log(`   Base: ₱${p.baseSalary} | Over: ₱${p.over} | Short: ₱${p.short} | Total: ₱${p.totalSalary}\n`);
});
