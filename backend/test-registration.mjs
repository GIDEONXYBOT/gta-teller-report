#!/usr/bin/env node

import axios from 'axios';

const token = 'test-token';
const gameDate = '2025-12-08';
const baseURL = 'http://localhost:5000';

async function testEndpoint(endpoint) {
  try {
    console.log(`\n🧪 Testing: ${endpoint}`);
    const response = await axios.get(`${baseURL}/api/chicken-fight-registration${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    console.log(`✅ Status: ${response.status}`);
    console.log(`📦 Response:`, JSON.stringify(response.data, null, 2));
    return response.status === 200;
  } catch (err) {
    console.error(`❌ Error:`, err.response?.status || err.code, err.message);
    if (err.response?.data) {
      console.error(`   Data:`, err.response.data);
    }
    return false;
  }
}

async function main() {
  console.log('🧪 Testing Chicken Fight Registration Endpoints\n');
  
  const results = [];
  results.push(await testEndpoint(`/registrations?gameDate=${gameDate}`));
  results.push(await testEndpoint(`/registrations-stats?gameDate=${gameDate}`));
  
  console.log(`\n📊 Summary: ${results.filter(r => r).length}/${results.length} endpoints working`);
  process.exit(results.every(r => r) ? 0 : 1);
}

main();
