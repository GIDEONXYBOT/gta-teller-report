// Check which tellers are assigned to which supervisors
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from './models/User.js';

dotenv.config();

async function checkAssignments() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB connected\n');

    const supervisors = await User.find({ 
      role: { $in: ['supervisor', 'supervisor_teller'] } 
    }).select('_id username name').lean();

    const tellers = await User.find({ 
      role: { $in: ['teller', 'supervisor_teller'] } 
    }).select('_id username name supervisorId').lean();

    console.log('📊 SUPERVISOR ASSIGNMENTS:\n');
    console.log('='.repeat(80));

    for (const sup of supervisors) {
      console.log(`\n👤 Supervisor: ${sup.name || sup.username}`);
      console.log(`   ID: ${sup._id}`);
      
      const assignedTellers = tellers.filter(t => 
        t.supervisorId && t.supervisorId.toString() === sup._id.toString()
      );
      
      if (assignedTellers.length > 0) {
        console.log(`   ✅ Assigned Tellers (${assignedTellers.length}):`);
        assignedTellers.forEach(t => {
          console.log(`      - ${t.name || t.username} (${t.username})`);
        });
      } else {
        console.log(`   ⚠️  No tellers assigned`);
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n📋 UNASSIGNED TELLERS:\n');
    
    const unassigned = tellers.filter(t => !t.supervisorId);
    if (unassigned.length > 0) {
      unassigned.forEach(t => {
        console.log(`   ⚠️  ${t.name || t.username} (${t.username}) - ID: ${t._id}`);
      });
      console.log(`\n💡 To assign a teller to a supervisor, you need to:`);
      console.log(`   1. Go to Admin > User Approval`);
      console.log(`   2. Edit the teller`);
      console.log(`   3. Select a supervisor from the dropdown`);
    } else {
      console.log('   ✅ All tellers are assigned!');
    }

    await mongoose.connection.close();
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

checkAssignments();
