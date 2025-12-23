async function testSync() {
  try {
    console.log('🔄 Calling sync-month-all endpoint...');
    const response = await fetch('http://localhost:5000/api/payroll/sync-month-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    const data = await response.json();
    console.log('✅ Response:', data);
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testSync();
