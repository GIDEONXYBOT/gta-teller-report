import mongoose from 'mongoose';
import Payroll from './models/Payroll.js';
import User from './models/User.js';
import dotenv from 'dotenv';

dotenv.config();

async function removeDuplicatePayrolls() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Get all payrolls
    const allPayrolls = await Payroll.find()
      .populate("user", "username name")
      .sort({ createdAt: 1 }) // oldest first
      .lean();

    console.log(`📦 Total payrolls: ${allPayrolls.length}\n`);

    // Group by user + date
    const byUserDate = new Map();
    
    for (const p of allPayrolls) {
      if (!p.user || !p.user._id) continue;
      
      const date = new Date(p.createdAt || p.date);
      const dateKey = `${date.getFullYear()}-${String(date.getMonth()).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      const userId = p.user._id.toString();
      const key = `${userId}|${dateKey}`;
      
      if (!byUserDate.has(key)) {
        byUserDate.set(key, []);
      }
      byUserDate.get(key).push(p);
    }

    // Find duplicates
    const toDelete = [];
    const toKeep = [];
    
    for (const [key, payrolls] of byUserDate) {
      if (payrolls.length > 1) {
        const [userId, dateKey] = key.split('|');
        const name = payrolls[0].user.name || payrolls[0].user.username;
        console.log(`🔍 ${name} has ${payrolls.length} payrolls on ${dateKey}`);
        
        // Sort by createdAt descending (newest first)
        payrolls.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        // Keep the newest one
        const keep = payrolls[0];
        toKeep.push(keep._id.toString());
        console.log(`   ✅ KEEP: ${keep._id} (newest, created ${new Date(keep.createdAt).toISOString()})`);
        
        // Delete the rest
        for (let i = 1; i < payrolls.length; i++) {
          const del = payrolls[i];
          toDelete.push(del._id);
          console.log(`   ❌ DELETE: ${del._id} (older, created ${new Date(del.createdAt).toISOString()})`);
        }
        console.log('');
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   Total duplicate records to delete: ${toDelete.length}`);
    console.log(`   Records to keep: ${toKeep.length}`);

    if (toDelete.length === 0) {
      console.log('\n✅ No duplicates found!');
      await mongoose.disconnect();
      return;
    }

    // Ask for confirmation (for safety)
    console.log('\n⚠️  About to DELETE these duplicate payrolls...');
    console.log('    (Keeping the newest payroll for each user/date combination)');
    
    // Delete the duplicates
    const result = await Payroll.deleteMany({ _id: { $in: toDelete } });
    console.log(`\n✅ Deleted ${result.deletedCount} duplicate payroll records`);

    // Verify
    const remaining = await Payroll.find()
      .populate("user", "username name")
      .lean();
    
    const verify = new Map();
    for (const p of remaining) {
      if (!p.user || !p.user._id) continue;
      const date = new Date(p.createdAt || p.date);
      const dateKey = `${date.getFullYear()}-${String(date.getMonth()).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      const userId = p.user._id.toString();
      const key = `${userId}|${dateKey}`;
      if (!verify.has(key)) {
        verify.set(key, 0);
      }
      verify.set(key, verify.get(key) + 1);
    }

    let stillHasDupes = false;
    for (const [key, count] of verify) {
      if (count > 1) {
        stillHasDupes = true;
        console.log(`⚠️  Still has duplicates: ${key} (${count} records)`);
      }
    }

    if (!stillHasDupes) {
      console.log(`\n✅ Verification passed: No duplicates remain!`);
      console.log(`   Total payrolls after cleanup: ${remaining.length}`);
    }

    await mongoose.disconnect();
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

removeDuplicatePayrolls();
