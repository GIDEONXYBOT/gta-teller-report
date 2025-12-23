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
    console.error('❌ Error:', err);
    process.exit(1);
  }
};

const entries = [
  { name: 'Black Cock', type: '2wins', bands: ['201', '202'] },
  { name: 'Golden Eagle', type: '3wins', bands: ['301', '302', '303'] },
  { name: 'Silver Fighter', type: '2wins', bands: ['401', '402'] }
];

const createRegistrations = async () => {
  try {
    const today = new Date(2025, 11, 11, 0, 0, 0, 0);

    for (const entryData of entries) {
      // Create entry if doesn't exist
      let entry = await ChickenFightEntry.findOne({
        entryName: entryData.name,
        gameDate: {
          $gte: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
          $lt: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
        }
      });

      if (!entry) {
        entry = new ChickenFightEntry({
          entryName: entryData.name,
          gameType: entryData.type,
          legBandNumbers: entryData.bands,
          legBandDetails: entryData.bands.map((band, idx) => ({
            legBand: band,
            featherType: idx % 2 === 0 ? 'Meron' : 'Wala'
          })),
          createdBy: new mongoose.Types.ObjectId(),
          createdByName: 'System',
          gameDate: today
        });
        await entry.save();
        console.log(`✅ Created entry: ${entryData.name}`);
      }

      // Create registration
      const existingReg = await ChickenFightRegistration.findOne({
        entryId: entry._id,
        gameDate: {
          $gte: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
          $lt: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
        }
      });

      if (!existingReg) {
        const registration = new ChickenFightRegistration({
          entryId: entry._id,
          entryName: entry.entryName,
          registrations: [{
            gameType: entryData.type,
            registrationFee: entryData.type === '2wins' ? 500 : 1000,
            isPaid: Math.random() > 0.5
          }],
          gameDate: today,
          createdBy: new mongoose.Types.ObjectId(),
          createdByName: 'System'
        });
        await registration.save();
        console.log(`✅ Registered: ${entryData.name}`);
      }
    }

    console.log('\n✅ All registrations created successfully!');

  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await mongoose.disconnect();
  }
};

connectDB().then(() => createRegistrations());
