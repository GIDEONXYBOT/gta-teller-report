import mongoose from "mongoose";

const tellerZoneSchema = new mongoose.Schema({
  name: { type: String, required: true },
  region: { type: String, required: true },
  description: String,
  assignedTellers: [String], // Array of teller usernames or IDs
  coordinates: {
    latitude: Number,
    longitude: Number,
  },
  createdBy: mongoose.Schema.Types.ObjectId,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

export default mongoose.model("TellerZone", tellerZoneSchema);
