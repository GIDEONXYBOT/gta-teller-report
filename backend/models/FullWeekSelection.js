import mongoose from 'mongoose';

const FullWeekSelectionSchema = new mongoose.Schema({
  weekKey: { type: String, required: true, index: true }, // e.g. '2025-11-24' (week start)
  tellerIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  count: { type: Number, default: 0 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('FullWeekSelection', FullWeekSelectionSchema);
