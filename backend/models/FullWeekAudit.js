import mongoose from 'mongoose';

const changeSchema = new mongoose.Schema({
  assignmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'DailyTellerAssignment', required: false },
  action: { type: String, enum: ['replace','append'], required: true },
  oldTellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
  oldTellerName: { type: String, required: false },
  newTellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
  newTellerName: { type: String, required: false }
});

const FullWeekAuditSchema = new mongoose.Schema({
  weekKey: { type: String, required: true, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  selection: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  count: { type: Number, default: 0 },
  changes: [changeSchema],
  createdAt: { type: Date, default: Date.now },
  reverted: { type: Boolean, default: false },
  revertedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  revertedAt: { type: Date, default: null }
});

export default mongoose.model('FullWeekAudit', FullWeekAuditSchema);
