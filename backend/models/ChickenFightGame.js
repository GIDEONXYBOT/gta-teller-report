import mongoose from 'mongoose';

const chickenFightGameSchema = new mongoose.Schema(
  {
    gameDate: {
      type: Date,
      required: true,
      unique: true,
      default: () => new Date(new Date().toLocaleDateString())
    },
    gameTypes: {
      type: [String],
      enum: ['2wins', '3wins'],
      required: true
    },
    entryResults: [
      {
        entryId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'ChickenFightEntry'
        },
        entryName: String,
        gameType: {
          type: String,
          enum: ['2wins', '3wins']
        },
        legResults: [
          {
            legNumber: Number,
            result: {
              type: String,
              enum: ['win', 'loss', 'noRecord', 'draw', 'cancelled']
            }
          }
        ],
        status: {
          type: String,
          enum: ['champion', 'insurance', 'none'],
          default: 'none'
        },
        prize: {
          type: Number,
          default: 0
        }
      }
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    isFinalized: {
      type: Boolean,
      default: false
    },
    fights: [
      {
        meronEntry: String,
        meronLegBand: String,
        walaEntry: String,
        walaLegBand: String,
        winner: String,
        timestamp: {
          type: Date,
          default: Date.now
        }
      }
    ],
    fightNumber: {
      type: Number,
      default: 0
    },
    bettingStatus: {
      type: String,
      enum: ['open', 'closed', 'suspended'],
      default: 'open'
    },
    lastUpdatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    lastUpdatedAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

export default mongoose.model('ChickenFightGame', chickenFightGameSchema);
