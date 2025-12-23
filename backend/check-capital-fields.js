import mongoose from 'mongoose';
import Capital from './models/Capital.js';
import User from './models/User.js';

await mongoose.connect('mongodb://localhost:27017/rmi_teller_report').then(async () => {
  try {
    console.log('\n🔍 CHECKING CAPITAL RECORDS:\n');
    
    const capitals = await Capital.find({}).lean();
    const users = await User.find({}).lean();
    
    capitals.forEach(c => {
      const teller = users.find(u => u._id.toString() === c.tellerId.toString());
      console.log(`Teller: ${teller?.name || 'Unknown'}`);
      console.log(`  Base Capital: ₱${c.amount}`);
      console.log(`  Total Additional: ₱${c.totalAdditional || 0}`);
      console.log(`  Total Remitted: ₱${c.totalRemitted || 0}`);
      console.log(`  Balance Remaining: ₱${c.balanceRemaining || 0}`);
      console.log(`  Formula Check: (${c.amount} + ${c.totalAdditional || 0}) - ${c.totalRemitted || 0} = ${(c.amount + (c.totalAdditional || 0)) - (c.totalRemitted || 0)}`);
      console.log();
    });
    
    console.log('✅ Done\n');
  } catch (err) {
    console.error('Error:', err.message);
  }
  
  await mongoose.connection.close();
}).catch(err => {
  console.error('Connection error:', err.message);
  process.exit(1);
});
