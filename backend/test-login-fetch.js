// Simple login test - run this while backend is running
async function testLogin() {
  const API = 'http://localhost:5000';
  
  console.log('🔐 Testing login endpoint...\n');
  
  try {
    const response = await fetch(`${API}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: 'admin',
        password: '12345'
      })
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Login SUCCESS!');
      console.log('Token:', data.token?.substring(0, 20) + '...');
      console.log('User:', data.user);
    } else {
      console.log('❌ Login FAILED');
      console.log('Status:', response.status);
      console.log('Message:', data.message);
    }
  } catch (error) {
    console.log('❌ Network ERROR');
    console.log('Error:', error.message);
  }
}

testLogin();
