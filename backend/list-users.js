import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/rmi_teller_report';

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, required: true },
  name: String,
  baseSalary: { type: Number, default: 0 }
}, { timestamps: true });

const User = mongoose.model('User', UserSchema);

async function listUsers() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const users = await User.find().select('username name role').sort({ name: 1 });
    
    console.log(`\n👥 Total users: ${users.length}\n`);
    users.forEach(u => {
      console.log(`  ${u.name || '(no name)'} - ${u.username} - ${u.role}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

listUsers();
