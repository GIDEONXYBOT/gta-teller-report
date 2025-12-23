// backend/models/BettingData.js
import mongoose from 'mongoose';

const bettingDataSchema = new mongoose.Schema({
  username: { type: String, required: true },
  totalBet: { type: Number, required: true, default: 0 },
  mwBetPercent: { type: Number, required: true, default: 0 },
  commission: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export default mongoose.model('BettingData', bettingDataSchema);
