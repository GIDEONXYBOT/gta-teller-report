// showReportsByDate.js
// Usage: node showReportsByDate.js [YYYY-MM-DD]
// Example: node showReportsByDate.js 2025-11-13

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/rmi_teller_report';

const dateArg = process.argv[2] || new Date().toISOString().split('T')[0];
const dateStr = dateArg;

function startOfDay(d) {
  const dt = new Date(d);
  dt.setHours(0,0,0,0);
  return dt;
}
function endOfDay(d) {
  const dt = new Date(d);
  dt.setHours(23,59,59,999);
  return dt;
}

async function run() {
  console.log(`Connecting to ${MONGO_URI}...`);
  await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected. Querying TellerReports for', dateStr);

  const start = startOfDay(dateStr);
  const end = endOfDay(dateStr);

  const coll = mongoose.connection.db.collection('tellerreports');

  const cursor = coll.find({
    $or: [
      { date: dateStr },
      { createdAt: { $gte: start, $lt: end } }
    ]
  }).sort({ createdAt: -1 });

  const results = await cursor.toArray();
  console.log(`Found ${results.length} report(s) for ${dateStr} (matching date field OR createdAt range)`);

  for (const r of results) {
    console.log('---');
    console.log('id:', r._id?.toString());
    console.log('tellerId:', r.tellerId);
    console.log('tellerName:', r.tellerName || r.tellerId?.name || r.userId);
    console.log('date field:', r.date);
    console.log('createdAt:', r.createdAt);
    console.log('systemBalance:', r.systemBalance);
    console.log('cashOnHand:', r.cashOnHand ?? r.totalFromDenomination);
    console.log('totalFromDenomination:', r.totalFromDenomination);
    console.log('over:', r.over, 'short:', r.short);
    console.log('remarks:', r.remarks);
  }

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
