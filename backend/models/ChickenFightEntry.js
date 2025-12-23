import mongoose from 'mongoose';

const chickenFightEntrySchema = new mongoose.Schema(
  {
    entryName: {
      type: String,
      required: true,
      trim: true
    },
    gameType: {
      type: String,
      enum: ['2wins', '3wins'],
      required: true
    },
    legBandNumbers: {
      type: [String],
      required: true,
      validate: {
        validator: function (v) {
          if (this.gameType === '2wins') return v.length === 2;
          if (this.gameType === '3wins') return v.length === 3;
          return false;
        },
        message: props => `Leg band numbers must have ${props.instance.gameType === '2wins' ? 2 : 3} entries`
      }
    },
    legBandDetails: [
      {
        legBand: String,
        featherType: {
          type: String,
          enum: ['Meron', 'Wala', 'Unknown', ''],
          default: ''
        }
      }
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    createdByName: {
      type: String,
      required: true
    },
    gameDate: {
      type: Date,
      default: () => new Date(new Date().toLocaleDateString())
    },
    isActive: {
      type: Boolean,
      default: true
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    deletedAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

export default mongoose.model('ChickenFightEntry', chickenFightEntrySchema);
