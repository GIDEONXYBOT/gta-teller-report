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

const addTodaysRegistration = async () => {
  try {
    // Create date for today in local timezone (2025-12-11)
    const today = new Date(2025, 11, 11, 0, 0, 0, 0);
    console.log('📅 Target date:', today.toISOString());

    // Check if entry already exists
    let entry = await ChickenFightEntry.findOne({
      gameDate: {
        $gte: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
        $lt: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
      },
      entryName: 'Red Dragon'
    });
    
    if (!entry) {
      // Create a test entry for today
      entry = new ChickenFightEntry({
        entryName: 'Red Dragon',
        gameType: '3wins',
        legBandNumbers: ['101', '102', '103'],
        legBandDetails: [
          { legBand: '101', featherType: 'Meron' },
          { legBand: '102', featherType: 'Meron' },
          { legBand: '103', featherType: 'Wala' }
        ],
        createdBy: new mongoose.Types.ObjectId(),
        createdByName: 'System',
        gameDate: today
      });
      await entry.save();
      console.log('✅ Created entry: Red Dragon');
    } else {
      console.log('✅ Using existing entry: Red Dragon');
    }

    // Check if registration already exists
    const existingReg = await ChickenFightRegistration.findOne({
      entryId: entry._id,
      gameDate: {
        $gte: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
        $lt: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
      }
    });

    if (existingReg) {
      console.log('⚠️ Registration already exists for this entry today');
      return;
    }

    // Create a registration for this entry
    const registration = new ChickenFightRegistration({
      entryId: entry._id,
      entryName: entry.entryName,
      registrations: [
        {
          gameType: '3wins',
          registrationFee: 1000,
          isPaid: false
        }
      ],
      gameDate: today,
      createdBy: new mongoose.Types.ObjectId(),
      createdByName: 'System'
    });

    await registration.save();
    console.log('✅ Created registration for: Red Dragon (3-Wins)');
    console.log('📊 Details:', {
      entryName: registration.entryName,
      gameDate: registration.gameDate.toLocaleDateString(),
      registrations: registration.registrations.map(r => ({
        gameType: r.gameType,
        fee: r.registrationFee,
        paid: r.isPaid
      }))
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
  await addTodaysRegistration();
};

main();
