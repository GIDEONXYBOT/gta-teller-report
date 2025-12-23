import mongoose from 'mongoose';

const FeedItemSchema = new mongoose.Schema({
  uploader: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  caption: { type: String, default: '' },
  imageUrl: { type: String }, // Keep for backward compatibility, but will store data URL
  thumbUrl: { type: String }, // Keep for backward compatibility, but will store data URL
  imageData: { type: String }, // Base64 encoded full image
  thumbData: { type: String }, // Base64 encoded thumbnail
  width: { type: Number },
  height: { type: Number },
  size: { type: Number },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Array of user IDs who liked
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('FeedItem', FeedItemSchema);
