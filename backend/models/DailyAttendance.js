import mongoose from "mongoose";

const dailyAttendanceSchema = new mongoose.Schema({
  date: {
    type: String,
    required: true,
    index: true // Format: YYYY-MM-DD
  },
  presentTellers: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    username: {
      type: String,
      required: true
    },
    name: {
      type: String,
      required: true
    },
    markedAt: {
      type: Date,
      default: Date.now
    }
  }],
  absentTellers: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    username: {
      type: String,
      required: true
    },
    name: {
      type: String,
      required: true
    },
    reason: {
      type: String,
      enum: ['sick', 'vacation', 'emergency', 'no-show', 'other'],
      default: 'no-show'
    },
    note: String,
    markedAt: {
      type: Date,
      default: Date.now
    }
  }],
  markedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  totalTellers: {
    type: Number,
    required: true
  },
  attendanceRate: {
    type: Number,
    min: 0,
    max: 100
  }
}, {
  timestamps: true
});

// Calculate attendance rate before saving
dailyAttendanceSchema.pre('save', function(next) {
  if (this.totalTellers > 0) {
    this.attendanceRate = Math.round((this.presentTellers.length / this.totalTellers) * 100);
  }
  next();
});

// Compound index for efficient queries
dailyAttendanceSchema.index({ date: 1, 'presentTellers.userId': 1 });
dailyAttendanceSchema.index({ date: 1, 'absentTellers.userId': 1 });

const DailyAttendance = mongoose.model("DailyAttendance", dailyAttendanceSchema);

export default DailyAttendance;