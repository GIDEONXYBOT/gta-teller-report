import mongoose from "mongoose";

const deploymentSchema = new mongoose.Schema(
  {
    // Basic deployment information
    deploymentId: {
      type: String,
      required: true,
      unique: true,
      default: () => `DEP-${Date.now()}`,
    },
    
    // What is being deployed
    itemType: {
      type: String,
      required: true,
      enum: ["equipment", "cash", "supplies", "documents", "other"],
    },
    
    itemName: {
      type: String,
      required: true,
      trim: true,
    },
    
    itemDescription: {
      type: String,
      trim: true,
      default: "",
    },
    
    quantity: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },

    // Individual asset items included in this deployment (optional granular tracking)
    items: [{
      assetId: {
        type: String,
        required: true,
        default: () => `AST-${Date.now()}-${Math.random().toString(36).slice(2,7)}`
      },
      type: {
        type: String,
        enum: ["printer","tablet","paper_pin","keys","cash_box","charger","stand","remote","other"],
        required: true,
        default: "other"
      },
      label: {
        type: String,
        required: true,
        trim: true
      },
      serialNumber: {
        type: String,
        trim: true
      },
      quantity: {
        type: Number,
        default: 1,
        min: 1
      },
      status: {
        type: String,
        enum: ["pending","assigned","in_use","pending_return","returned","damaged","lost"],
        default: "pending"
      },
      deployedAt: { type: Date },
      returnedAt: { type: Date },
      conditionOnReturn: { type: String, enum: ["excellent","good","fair","poor","damaged","lost"], default: undefined },
      damageNotes: { type: String, default: "" },
      // Optional pre-generated QR payload (can also be generated dynamically)
      qrSeed: { type: String, default: () => Math.random().toString(36).slice(2) }
    }],
    
    // Deployment tracking
    status: {
      type: String,
      enum: ["preparing", "deployed", "in_use", "pending_return", "returned", "lost", "damaged"],
      default: "preparing",
    },
    
    // Who handles the deployment
    declaratorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    
    // Which teller(s) received the items
    assignedTellers: [{
      tellerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
      tellerName: {
        type: String,
        required: true,
      },
      receivedAt: {
        type: Date,
        default: Date.now,
      },
      acknowledged: {
        type: Boolean,
        default: false,
      },
      acknowledgedAt: {
        type: Date,
      }
    }],
    
    // Deployment dates
    deployedAt: {
      type: Date,
    },
    
    expectedReturnDate: {
      type: Date,
      required: true,
    },
    
    actualReturnDate: {
      type: Date,
    },
    
    // Return tracking
    returnStatus: {
      type: String,
      enum: ["not_due", "due_soon", "overdue", "returned", "lost"],
      default: "not_due",
    },
    
    returnCondition: {
      type: String,
      enum: ["excellent", "good", "fair", "poor", "damaged", "lost"],
    },
    
    // Teller completeness verification
    tellerCompleteness: [{
      tellerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
      tellerName: {
        type: String,
        required: true,
      },
      isComplete: {
        type: Boolean,
        default: false,
      },
      verifiedAt: {
        type: Date,
      },
      notes: {
        type: String,
        default: "",
      }
    }],
    
    // Additional tracking
    notes: {
      type: String,
      default: "",
    },
    
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },
    
    // Verification that all tellers have completed their tasks
    allTellersComplete: {
      type: Boolean,
      default: false,
    },
    
    completedAt: {
      type: Date,
    },
    
  },
  {
    timestamps: true,
  }
);

// Index for better performance
deploymentSchema.index({ deploymentId: 1 });
deploymentSchema.index({ declaratorId: 1 });
deploymentSchema.index({ status: 1 });
deploymentSchema.index({ expectedReturnDate: 1 });
deploymentSchema.index({ "assignedTellers.tellerId": 1 });

// Virtual for overdue status
deploymentSchema.virtual('isOverdue').get(function() {
  if (!this.expectedReturnDate || this.status === 'returned') return false;
  return new Date() > this.expectedReturnDate;
});

// Method to check if all tellers have acknowledged
deploymentSchema.methods.checkAllTellersAcknowledged = function() {
  return this.assignedTellers.every(teller => teller.acknowledged);
};

// Method to check if all tellers are complete
deploymentSchema.methods.checkAllTellersComplete = function() {
  return this.tellerCompleteness.every(teller => teller.isComplete);
};

// Method to update return status based on dates
deploymentSchema.methods.updateReturnStatus = function() {
  // If all item assets returned (or there are none) and deployment marked returned
  if (this.status === 'returned') {
    this.returnStatus = 'returned';
    return;
  }

  // If items exist, compute aggregate status
  if (this.items && this.items.length > 0) {
    const total = this.items.length;
    const returned = this.items.filter(i => i.status === 'returned').length;
    const damaged = this.items.filter(i => i.status === 'damaged').length;
    const lost = this.items.filter(i => i.status === 'lost').length;

    if (returned === total) {
      this.status = 'returned';
      this.returnStatus = 'returned';
      this.actualReturnDate = this.actualReturnDate || new Date();
      return;
    }

    // If any lost or damaged, keep deployment in pending_return until reviewed
    if (damaged > 0 || lost > 0) {
      this.status = 'pending_return';
    }
  }

  const now = new Date();
  const returnDate = new Date(this.expectedReturnDate);
  const daysDiff = Math.ceil((returnDate - now) / (1000 * 60 * 60 * 24));

  if (daysDiff < 0) {
    this.returnStatus = 'overdue';
  } else if (daysDiff <= 3) {
    this.returnStatus = 'due_soon';
  } else {
    this.returnStatus = 'not_due';
  }
};

// Pre-save middleware to update return status and completeness
deploymentSchema.pre('save', function(next) {
  this.updateReturnStatus();
  this.allTellersComplete = this.checkAllTellersComplete();
  
  if (this.allTellersComplete && !this.completedAt) {
    this.completedAt = new Date();
  }
  
  next();
});

const Deployment = mongoose.model("Deployment", deploymentSchema);

export default Deployment;