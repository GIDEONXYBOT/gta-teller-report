import mongoose from 'mongoose';

const CommentSchema = new mongoose.Schema({
  feedItem: { type: mongoose.Schema.Types.ObjectId, ref: 'FeedItem', required: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true, maxlength: 500 },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Comment', CommentSchema);