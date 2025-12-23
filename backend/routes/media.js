import express from 'express';
import path from 'path';
import fs from 'fs/promises';
import sharp from 'sharp';
import FeedItem from '../models/FeedItem.js';
import Comment from '../models/Comment.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// POST /api/media/upload
// Accepts JSON: { image: 'data:image/png;base64,...', caption: '...' }
router.post('/upload', requireAuth, async (req, res) => {
  try {
    const { image, caption } = req.body;
    if (!image) return res.status(400).json({ success: false, message: 'No image provided' });

    // decode
    const match = image.match(/^data:(image\/\w+);base64,(.*)$/);
    let data = image;
    let mime = 'image/png';
    if (match) {
      mime = match[1];
      data = match[2];
    }

    const buffer = Buffer.from(data, 'base64');

    // validations
    const MIN_BYTES = 8 * 1024;
    const MIN_W = 128;
    const MIN_H = 128;
    if (buffer.length < MIN_BYTES) return res.status(400).json({ success: false, message: 'Image file too small' });

    let meta;
    try { meta = await sharp(buffer).metadata(); } catch (err) { return res.status(400).json({ success: false, message: 'Invalid image' }); }
    if (meta.width < MIN_W || meta.height < MIN_H) return res.status(400).json({ success: false, message: `Image dimensions must be at least ${MIN_W}x${MIN_H}` });

    // ensure directory (keeping for backward compatibility, but not used for storage)
    const uploadsDir = path.resolve('uploads', 'feed');
    await fs.mkdir(uploadsDir, { recursive: true });

    // file names (keeping for reference, but not used)
    const idBase = `${req.user._id.toString()}-${Date.now()}`;
    const mainName = `${idBase}.png`;
    const thumbName = `${idBase}-thumb.png`;

    // process images: main 1024 cover, thumb 320 crop
    const mainBuffer = await sharp(buffer).resize({ width: 1024, height: 1024, fit: 'cover' }).png({ quality: 90 }).toBuffer();
    const thumbBuffer = await sharp(buffer).resize({ width: 320, height: 320, fit: 'cover' }).png({ quality: 80 }).toBuffer();

    // Convert to base64 data URLs
    const mainDataUrl = `data:image/png;base64,${mainBuffer.toString('base64')}`;
    const thumbDataUrl = `data:image/png;base64,${thumbBuffer.toString('base64')}`;

    const feed = new FeedItem({
      uploader: req.user._id,
      caption: caption || '',
      imageUrl: mainDataUrl, // Store as data URL
      thumbUrl: thumbDataUrl, // Store as data URL
      imageData: mainBuffer.toString('base64'), // Store raw base64 for API access
      thumbData: thumbBuffer.toString('base64'), // Store raw base64 for API access
      width: meta.width,
      height: meta.height,
      size: buffer.length
    });

    await feed.save();
    res.json({ success: true, item: feed });
  } catch (err) {
    console.error('Media upload failed', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/media/feed - latest feed items
// GET /api/media/feed - latest feed items (optional ?userId=... to filter by uploader)
router.get('/feed', async (req, res) => {
  try {
    const { userId } = req.query;
    const filter = {};
    if (userId) filter.uploader = userId;
    const list = await FeedItem.find(filter).sort({ createdAt: -1 }).limit(50).populate('uploader', 'username name avatarUrl').populate('likes', 'username name');
    res.json({ success: true, items: list });
  } catch (err) {
    console.error('Failed to fetch feed', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// DELETE /api/media/feed/:id - delete feed item (only by uploader)
router.delete('/feed/:id', requireAuth, async (req, res) => {
  try {
    const feedItem = await FeedItem.findById(req.params.id);
    if (!feedItem) return res.status(404).json({ success: false, message: 'Feed item not found' });

    // Only allow uploader to delete
    if (feedItem.uploader.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this item' });
    }

    // Delete associated comments
    await Comment.deleteMany({ feedItem: req.params.id });

    // Delete the feed item
    await FeedItem.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: 'Feed item deleted' });
  } catch (err) {
    console.error('Failed to delete feed item', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/media/feed/:id/like - like/unlike feed item
router.post('/feed/:id/like', requireAuth, async (req, res) => {
  try {
    const feedItem = await FeedItem.findById(req.params.id);
    if (!feedItem) return res.status(404).json({ success: false, message: 'Feed item not found' });

    const userId = req.user._id;
    const isLiked = feedItem.likes.includes(userId);

    if (isLiked) {
      // Unlike
      feedItem.likes = feedItem.likes.filter(id => id.toString() !== userId.toString());
    } else {
      // Like
      feedItem.likes.push(userId);
    }

    await feedItem.save();

    res.json({
      success: true,
      liked: !isLiked,
      likesCount: feedItem.likes.length
    });
  } catch (err) {
    console.error('Failed to toggle like', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/media/feed/:id/comments - add comment
router.post('/feed/:id/comments', requireAuth, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: 'Comment content is required' });
    }

    const feedItem = await FeedItem.findById(req.params.id);
    if (!feedItem) return res.status(404).json({ success: false, message: 'Feed item not found' });

    const comment = new Comment({
      feedItem: req.params.id,
      author: req.user._id,
      content: content.trim()
    });

    await comment.save();

    // Populate author info for response
    await comment.populate('author', 'username name avatarUrl');

    res.json({ success: true, comment });
  } catch (err) {
    console.error('Failed to add comment', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/media/feed/:id/comments - get comments for feed item
router.get('/feed/:id/comments', async (req, res) => {
  try {
    const comments = await Comment.find({ feedItem: req.params.id })
      .sort({ createdAt: 1 })
      .populate('author', 'username name avatarUrl');

    res.json({ success: true, comments });
  } catch (err) {
    console.error('Failed to fetch comments', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// DELETE /api/media/comments/:id - delete comment (only by author)
router.delete('/comments/:id', requireAuth, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) return res.status(404).json({ success: false, message: 'Comment not found' });

    // Only allow author to delete
    if (comment.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this comment' });
    }

    await Comment.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: 'Comment deleted' });
  } catch (err) {
    console.error('Failed to delete comment', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/media/migrate-images - migrate existing file-based images to base64
router.post('/migrate-images', requireAuth, async (req, res) => {
  try {
    // Only allow admin to migrate
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    const feedItems = await FeedItem.find({
      imageUrl: { $regex: '^/uploads/feed/' },
      imageData: { $exists: false }
    }).limit(10); // Process in batches

    let migrated = 0;
    const errors = [];

    for (const item of feedItems) {
      try {
        const filePath = path.resolve('uploads', 'feed', path.basename(item.imageUrl));
        const thumbPath = path.resolve('uploads', 'feed', path.basename(item.thumbUrl));

        // Check if files exist
        const [mainExists, thumbExists] = await Promise.all([
          fs.access(filePath).then(() => true).catch(() => false),
          fs.access(thumbPath).then(() => true).catch(() => false)
        ]);

        if (mainExists && thumbExists) {
          // Read and convert to base64
          const [mainBuffer, thumbBuffer] = await Promise.all([
            fs.readFile(filePath),
            fs.readFile(thumbPath)
          ]);

          const mainDataUrl = `data:image/png;base64,${mainBuffer.toString('base64')}`;
          const thumbDataUrl = `data:image/png;base64,${thumbBuffer.toString('base64')}`;

          // Update the item
          await FeedItem.findByIdAndUpdate(item._id, {
            imageUrl: mainDataUrl,
            thumbUrl: thumbDataUrl,
            imageData: mainBuffer.toString('base64'),
            thumbData: thumbData.toString('base64')
          });

          migrated++;
        } else {
          errors.push(`Files not found for item ${item._id}`);
        }
      } catch (err) {
        errors.push(`Failed to migrate item ${item._id}: ${err.message}`);
      }
    }

    res.json({
      success: true,
      migrated,
      errors,
      message: `Migrated ${migrated} images${errors.length ? `. Errors: ${errors.join(', ')}` : ''}`
    });
  } catch (err) {
    console.error('Migration failed:', err);
    res.status(500).json({ success: false, message: 'Migration failed' });
  }
});

export default router;
