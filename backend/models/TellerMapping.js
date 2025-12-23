import mongoose from "mongoose";

const TellerMappingSchema = new mongoose.Schema(
  {
    // Reference to the teller in our reporting system
    tellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Betting API identifiers
    bettingUsername: {
      type: String,
      required: true,
      unique: true, // Each betting username can only map to one teller
    },

    bettingName: {
      type: String,
      required: true,
    },

    // Matching confidence and method
    matchConfidence: {
      type: String,
      enum: ["exact", "fuzzy", "manual"],
      default: "manual",
    },

    matchReason: {
      type: String,
      default: "",
    },

    // Status
    isActive: {
      type: Boolean,
      default: true,
    },

    // Last sync information
    lastBettingSync: {
      type: Date,
      default: null,
    },

    bettingData: {
      lastBetAmount: { type: Number, default: 0 },
      lastSystemBalance: { type: Number, default: 0 },
      lastSyncDate: { type: Date, default: null },
    },
  },
  { timestamps: true }
);

// Compound index to ensure unique betting username mappings
TellerMappingSchema.index({ bettingUsername: 1, isActive: 1 });

export default mongoose.model("TellerMapping", TellerMappingSchema);