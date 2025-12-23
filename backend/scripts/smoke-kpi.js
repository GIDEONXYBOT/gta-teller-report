#!/usr/bin/env node
import axios from 'axios';

const API = process.env.API_URL || 'http://localhost:5000';

(async function run() {
  try {
    console.log('➡️  Hitting KPI endpoint:', `${API}/api/reports/kpi/tellers`);
    const resp = await axios.get(`${API}/api/reports/kpi/tellers`, { timeout: 10000 });
    console.log('✅ Status:', resp.status);
    console.log('🔎 Source:', resp.data?.data?.source, 'subSource:', resp.data?.data?.subSource);
    console.log('📊 Summary:', resp.data?.data?.summary || {});
    console.log('👥 Tellers count:', (resp.data?.data?.tellers || []).length);
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed to reach KPI endpoint:', err.message || err);
    if (err.response) {
      console.error('Status', err.response.status, 'data', JSON.stringify(err.response.data, null, 2));
    }
    process.exit(2);
  }
})();
