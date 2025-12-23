// test-login-mobile.js - Test mobile login issues
import fetch from 'node-fetch';

const API_URL = 'http://192.168.0.167:5000';

async function testLogin(username, password) {
  try {
    console.log(`\n🔐 Testing login for: ${username}`);
    
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mobile-Test-Script/1.0'
      },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log(`✅ Login successful!`);
      console.log(`   User: ${data.user.name} (${data.user.role})`);
      console.log(`   Token: ${data.token.substring(0, 50)}...`);
      return true;
    } else {
      console.log(`❌ Login failed: ${data.message}`);
      console.log(`   Status: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Network error: ${error.message}`);
    return false;
  }
}

async function getAllUsers() {
  try {
    console.log('\n📋 Fetching all users...');
    
    const response = await fetch(`${API_URL}/api/users`, {
      headers: {
        'User-Agent': 'Mobile-Test-Script/1.0'
      }
    });

    if (response.ok) {
      const users = await response.json();
      console.log(`\n👥 Found ${users.length} users:`);
      users.forEach(user => {
        console.log(`   - ${user.username} | ${user.name} | ${user.role} | ${user.status}`);
      });
      return users;
    } else {
      console.log(`❌ Failed to fetch users: ${response.status}`);
      return [];
    }
  } catch (error) {
    console.log(`❌ Network error: ${error.message}`);
    return [];
  }
}

async function testHealthEndpoint() {
  try {
    console.log('\n🏥 Testing health endpoint...');
    
    const response = await fetch(`${API_URL}/api/health`);
    const data = await response.json();
    
    console.log('✅ Health check successful:');
    console.log(`   Server IP: ${data.serverIP}`);
    console.log(`   Timestamp: ${data.timestamp}`);
    return true;
  } catch (error) {
    console.log(`❌ Health check failed: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('🧪 Mobile Login Test Script');
  console.log('=' .repeat(50));
  
  // Test health endpoint first
  const healthOk = await testHealthEndpoint();
  if (!healthOk) {
    console.log('❌ Backend server is not accessible. Exiting.');
    return;
  }
  
  // Get all users
  const users = await getAllUsers();
  
  // Test common login attempts
  const testCases = [
    ['admin', 'admin123'],
    ['admin', 'admin'],
    ['Daniel', '12345'],
    ['test', 'test'],
    ['supervisor', 'supervisor']
  ];
  
  console.log('\n🔐 Testing common login combinations...');
  console.log('=' .repeat(50));
  
  for (const [username, password] of testCases) {
    await testLogin(username, password);
    await new Promise(resolve => setTimeout(resolve, 500)); // Small delay
  }
  
  // If we found users, test their usernames with common passwords
  if (users.length > 0) {
    console.log('\n🔐 Testing actual usernames with common passwords...');
    console.log('=' .repeat(50));
    
    const commonPasswords = ['12345', 'admin', 'password', 'admin123'];
    
    for (const user of users.slice(0, 5)) { // Test first 5 users
      for (const password of commonPasswords) {
        const success = await testLogin(user.username, password);
        if (success) break; // If successful, move to next user
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
  }
  
  console.log('\n✨ Test completed!');
}

main().catch(console.error);