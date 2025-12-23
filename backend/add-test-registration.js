import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import ChickenFightEntry from './models/ChickenFightEntry.js';
import ChickenFightRegistration from './models/ChickenFightRegistration.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/rmi-teller-report');
    console.log('✅ Connected to MongoDB');
  } catch (err) {
    console.error('❌ Error connecting to MongoDB:', err);
    process.exit(1);
  }
};

const addTestRegistration = async () => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get an existing entry or create one
    let entry = await ChickenFightEntry.findOne({ gameDate: today });
    
    if (!entry) {
      // Create a test entry
      entry = new ChickenFightEntry({
        entryName: 'Test Chicken',
        gameType: '2wins',
        legBandNumbers: ['001', '002'],
        legBandDetails: [
          { legBand: '001', featherType: 'Meron' },
          { legBand: '002', featherType: 'Wala' }
        ],
        createdBy: new mongoose.Types.ObjectId(),
        createdByName: 'System',
        gameDate: today
      });
      await entry.save();
      console.log('✅ Created test entry:', entry.entryName);
    } else {
      console.log('✅ Using existing entry:', entry.entryName);
    }

    // Create a registration for this entry
    const registration = new ChickenFightRegistration({
      entryId: entry._id,
      entryName: entry.entryName,
      registrations: [
        {
          gameType: '2wins',
          amount: 500,
          status: 'pending'
        }
      ],
      gameDate: today,
      createdBy: new mongoose.Types.ObjectId(),
      createdByName: 'System'
    });

    await registration.save();
    console.log('✅ Created test registration for:', entry.entryName);
    console.log('📊 Registration details:', {
      entryName: registration.entryName,
      gameDate: registration.gameDate,
      registrations: registration.registrations
    });

  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
};

const main = async () => {
  await connectDB();
  await addTestRegistration();
};

main();
