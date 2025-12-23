import mongoose from 'mongoose';

const payrollAuditLogSchema = new mongoose.Schema(
  {
    actionType: {
      type: String,
      enum: ['UPDATE_BASE_SALARY', 'BATCH_UPDATE', 'MANUAL_CORRECTION'],
      required: true
    },
    performedBy: {
      userId: mongoose.Schema.Types.ObjectId,
      name: String,
      email: String,
      role: String
    },
    targetEmployees: [
      {
        employeeId: mongoose.Schema.Types.ObjectId,
        employeeName: String,
        baseSalaryBefore: Number,
        baseSalaryAfter: Number,
        affectedRecords: Number
      }
    ],
    totalRecordsUpdated: {
      type: Number,
      default: 0
    },
    payrollsUpdated: {
      type: Number,
      default: 0
    },
    usersUpdated: {
      type: Number,
      default: 0
    },
    changes: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    reason: String,
    status: {
      type: String,
      enum: ['SUCCESS', 'PARTIAL', 'FAILED'],
      default: 'SUCCESS'
    },
    errorMessage: String,
    ipAddress: String,
    userAgent: String,
    notificationSent: {
      type: Boolean,
      default: false
    },
    notificationRecipients: [String],
    createdAt: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  { timestamps: true }
);

// Index for quick lookups
payrollAuditLogSchema.index({ 'performedBy.userId': 1, createdAt: -1 });
payrollAuditLogSchema.index({ actionType: 1, createdAt: -1 });

const PayrollAuditLog = mongoose.model('PayrollAuditLog', payrollAuditLogSchema);

export default PayrollAuditLog;
