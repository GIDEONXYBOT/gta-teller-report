import mongoose from 'mongoose';

async function main() {
  try {
    const uri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb+srv://rmi_admin:rmi1234@rmi-teller-report.fphrmaw.mongodb.net/rmi?retryWrites=true&w=majority&connectTimeoutMS=30000&socketTimeoutMS=30000';
    await mongoose.connect(uri);
    console.log('Connected to DB');

    const args = process.argv.slice(2);
    if (args.length < 2) {
      console.error('Usage: node check-reports-range.js <startDate> <endDate>');
      process.exit(1);
    }

    const start = new Date(args[0]);
    const end = new Date(args[1]);
    if (isNaN(start) || isNaN(end)) {
      console.error('Invalid dates');
      process.exit(1);
    }

    const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0);
    const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59, 999);

    const Schema = mongoose.Schema;
    const TR = mongoose.model('TellerReport', new Schema({}, { strict: false }), 'tellerreports');

    const count = await TR.find({ date: { $gte: startDay, $lte: endDay } }).countDocuments();
    console.log(`Teller reports between ${startDay.toISOString()} and ${endDay.toISOString()}: ${count}`);

    // print sample for debugging
    const samples = await TR.find({ date: { $gte: startDay, $lte: endDay } }).limit(10).lean();
    console.log('Sample reports (max 10):', samples.map(s => ({ _id: s._id, tellerId: s.tellerId, date: s.date, over: s.over, short: s.short })));

    process.exit(0);
  } catch (err) {
    console.error('Error checking reports:', err?.message || err);
    process.exit(2);
  }
}

main();
