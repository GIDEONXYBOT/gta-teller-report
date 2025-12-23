#!/usr/bin/env node
import mongoose from 'mongoose';
import axios from 'axios';

async function main() {
  const [startArg, endArg] = process.argv.slice(2);
  if (!startArg || !endArg) {
    console.error('Usage: node sync-reports-to-payroll.js <startDate> <endDate>');
    process.exit(1);
  }

  const start = new Date(startArg + 'T00:00:00.000Z');
  const end = new Date(endArg + 'T23:59:59.999Z');

  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    console.error('Missing MONGO_URI in environment');
    process.exit(1);
  }

  await mongoose.connect(uri);
  const Schema = mongoose.Schema;
  const TR = mongoose.model('TellerReport', new Schema({}, { strict: false }), 'tellerreports');

  const tellerIds = await TR.distinct('tellerId', { createdAt: { $gte: start, $lte: end } });
  console.log(`Found ${tellerIds.length} tellers with reports between ${start.toISOString()} and ${end.toISOString()}`);

  const token = process.env.ADMIN_TOKEN;
  if (!token) {
    console.error('Missing ADMIN_TOKEN env var (used to call /api/payroll/sync-teller-reports)');
    process.exit(1);
  }

  for (const tid of tellerIds) {
    try {
      console.log('Syncing payroll for teller', tid);
      const res = await axios.post('https://rmi-backend-zhdr.onrender.com/api/payroll/sync-teller-reports', {
        userId: tid,
        startDate: startArg,
        endDate: endArg
      }, { headers: { Authorization: `Bearer ${token}` } });
      console.log(' =>', res.data?.message, 'reportsProcessed=', res.data?.reportsProcessed);
    } catch (err) {
      console.warn('Failed to sync for teller', tid, err?.response?.data || err.message);
    }
  }

  console.log('Done.');
  process.exit(0);
}

main().catch(e=>{console.error(e);process.exit(1)})
