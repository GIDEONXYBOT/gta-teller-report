#!/usr/bin/env node

import fetch from 'node-fetch';

const token = 'test-token';
const gameDate = '2025-12-08';

async function testEndpoint(endpoint) {
  try {
    console.log(`\n🧪 Testing: ${endpoint}`);
    const response = await fetch(`http://localhost:5000/api/chicken-fight-registration${endpoint}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log(`📊 Status: ${response.status} ${response.statusText}`);
    const data = await response.json();
    console.log(`📦 Response:`, JSON.stringify(data, null, 2));
    return response.status === 200;
  } catch (err) {
    console.error(`❌ Error:`, err.message);
    return false;
  }
}

async function main() {
  console.log('🧪 Testing Chicken Fight Registration Endpoints\n');
  
  const results = [];
  results.push(await testEndpoint(`/registrations?gameDate=${gameDate}`));
  results.push(await testEndpoint(`/registrations-stats?gameDate=${gameDate}`));
  
  console.log(`\n✅ Test Summary: ${results.filter(r => r).length}/${results.length} passed`);
  process.exit(results.every(r => r) ? 0 : 1);
}

main();
