import axios from 'axios';

try {
  console.log('\n📡 Calling admin endpoint...\n');
  
  const response = await axios.get('http://localhost:5000/api/admin/teller-overview');
  
  console.log(`✅ Response status: ${response.status}`);
  console.log(`📊 Total tellers returned: ${response.data.data?.length || 0}\n`);
  
  if (response.data.data && response.data.data.length > 0) {
    response.data.data.forEach(t => {
      console.log(`\n👤 ${t.name}:`);
      console.log(`   Base Capital: ₱${t.baseCapital || 0}`);
      console.log(`   Additional: ₱${t.additionalCapital || 0} (${t.additionalCount || 0} txns)`);
      console.log(`   Remitted: ₱${t.totalRemittances || 0} (${t.remittanceCount || 0} txns)`);
      console.log(`   Balance: ₱${t.balance || 0}`);
      console.log(`   Has transactions today? ${t.hasTransactionsToday}`);
    });
  } else {
    console.log('❌ No tellers returned from endpoint');
  }
  
  console.log('\n✅ Done\n');
} catch (err) {
  console.error('❌ Error:', err.response?.data || err.message);
}
