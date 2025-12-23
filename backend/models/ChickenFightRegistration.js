import mongoose from 'mongoose';

const chickenFightRegistrationSchema = new mongoose.Schema(
  {
    entryId: {
      type: mongoose.Schema.Types.Mixed, // Allow string or ObjectId
      required: true
    },
    entryName: {
      type: String,
      required: true
    },
    gameDate: {
      type: Date,
      required: true,
      index: true
    },
    // Track which game types have paid registration
    registrations: [
      {
        gameType: {
          type: String,
          enum: ['2wins', '3wins'],
          required: true
        },
        registrationFee: {
          type: Number,
          default: 0 // Will be set per game type (e.g., 300 for 2wins, 1000 for 3wins)
        },
        isPaid: {
          type: Boolean,
          default: false
        },
        paidDate: {
          type: Date,
          default: null
        },
        paidBy: {
          type: String,
          default: null // Username of person who marked as paid
        }
      }
    ],
    createdBy: {
      type: String,
      required: true
    },
    updatedBy: {
      type: String,
      default: null
    },
    insurancePaid: {
      type: Boolean,
      default: false
    },
    insurancePaidDate: {
      type: Date,
      default: null
    },
    insurancePaidBy: {
      type: String,
      default: null
    },
    isValidChampion: {
      type: Boolean,
      default: true // Default to true, can be marked as invalid
    },
    notes: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

// Compound index for quick lookup
chickenFightRegistrationSchema.index({ gameDate: 1, entryId: 1 });
chickenFightRegistrationSchema.index({ gameDate: 1, entryName: 1 });

const ChickenFightRegistration = mongoose.model(
  'ChickenFightRegistration',
  chickenFightRegistrationSchema,
  'chicken_fight_registrations'
);

export default ChickenFightRegistration;
