import mongoose from 'mongoose';

const PointSchema = new mongoose.Schema({
  x: { type: Number, required: true }, // normalized 0..1
  y: { type: Number, required: true }, // normalized 0..1
}, { _id: false });

const MarkerSchema = new mongoose.Schema({
  id: { type: String, required: true },
  label: { type: String, default: '' },
  position: { type: PointSchema, required: true },
  tellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { _id: false });

const RegionSchema = new mongoose.Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  points: { type: [PointSchema], default: [] },
  tellerIds: { type: [mongoose.Schema.Types.ObjectId], ref: 'User', default: [] },
}, { _id: false });

const MapConfigSchema = new mongoose.Schema({
  imageData: { type: String, default: '' }, // data URL (base64) or external URL
  imageWidth: { type: Number, default: 0 },
  imageHeight: { type: Number, default: 0 },
  markers: { type: [MarkerSchema], default: [] },
  regions: { type: [RegionSchema], default: [] },
  updatedAt: { type: Date, default: Date.now },
});

export default mongoose.model('MapConfig', MapConfigSchema);
