// Quick script to test login endpoint directly
import axios from 'axios';

const API = process.env.API_URL || 'http://localhost:5000';

async function testLogin() {
  try {
    console.log('🔐 Testing login endpoint at:', `${API}/api/auth/login`);
    
    const response = await axios.post(`${API}/api/auth/login`, {
      username: 'admin',
      password: '12345'
    });
    
    console.log('✅ Login successful!');
    console.log('Response:', response.data);
  } catch (error) {
    console.error('❌ Login failed!');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else if (error.request) {
      console.error('No response received');
      console.error('Request:', error.request);
    } else {
      console.error('Error:', error.message);
    }
  }
}

testLogin();
