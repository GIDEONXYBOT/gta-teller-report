import axios from 'axios';

const API_BASE = 'https://www.rmi.gideonbot.xyz/api';

const names = ['charm', 'missy', 'jenessa', 'shane', 'apple', 'keanna'];

(async () => {
  console.log('\n🌐 CHECKING LIVE PAYROLL VIA API:\n');
  
  try {
    // Fetch all payrolls
    const response = await axios.get(`${API_BASE}/payroll/all`, {
      timeout: 10000,
      headers: {
        'Accept': 'application/json'
      }
    });
    
    let payrolls = response.data;
    
    // Debug: Show response structure
    console.log('Response type:', typeof payrolls);
    console.log('Is array?', Array.isArray(payrolls));
    if (typeof payrolls === 'object' && !Array.isArray(payrolls)) {
      console.log('Response keys:', Object.keys(payrolls).slice(0, 5));
      payrolls = payrolls.payrolls || payrolls.data || Object.values(payrolls);
    }
    payrolls = Array.isArray(payrolls) ? payrolls : [];
    
    console.log(`✅ Total payrolls to search: ${payrolls.length}\n`);
    
    if (payrolls.length > 0) {
      console.log('Sample payroll:', JSON.stringify(payrolls[0]).substring(0, 150));
      console.log('\n');
    }
    
    // Search for our names in payrolls
    for (const name of names) {
      const matching = payrolls.filter(p => {
        const tellerName = (p.user?.name || p.tellerName || p.name || '').toLowerCase();
        return tellerName.includes(name.toLowerCase());
      });
      
      if (matching.length > 0) {
        console.log(`✅ ${name.toUpperCase()}: Found ${matching.length} payroll record(s)`);
        matching.slice(0, 3).forEach(p => {
          console.log(`   📅 ${p.date || 'N/A'} | Base: ₱${p.baseSalary || 0} | Total: ₱${p.totalPayout || p.amount || 0}`);
        });
      } else {
        console.log(`❌ ${name.toUpperCase()}: No payroll records found`);
      }
      console.log();
    }
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
  
  process.exit(0);
})();
