import mongoose from 'mongoose';

const chickenFightBetSchema = new mongoose.Schema(
  {
    gameDate: {
      type: Date,
      required: true
    },
    gameType: {
      type: String,
      enum: ['2wins', '3wins', 'both'],
      required: true
    },
    entryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ChickenFightEntry',
      required: true
    },
    entryName: {
      type: String,
      required: true
    },
    side: {
      type: String,
      enum: ['meron', 'wala'],
      required: true
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    createdByName: {
      type: String,
      required: true
    },
    result: {
      type: String,
      enum: ['pending', 'win', 'loss'],
      default: 'pending'
    },
    payout: {
      type: Number,
      default: 0
    }
  },
  { timestamps: true }
);

export default mongoose.model('ChickenFightBet', chickenFightBetSchema);
