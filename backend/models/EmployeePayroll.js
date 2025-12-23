import mongoose from "mongoose";

const EmployeePayrollSchema = new mongoose.Schema({
  employeeId: { 
    type: mongoose.Schema.Types.ObjectId,
    ref: "Employee",
    required: true,
    index: true
  },
  employeeName: { 
    type: String, 
    required: true 
  },
  position: { 
    type: String, 
    required: true 
  },
  amount: { 
    type: Number, 
    required: true 
  },
  dateKey: { 
    type: String, 
    required: true,
    index: true 
  }, // YYYY-MM-DD format
  notes: { 
    type: String, 
    default: "" 
  },
  createdBy: { 
    type: String, 
    default: "" 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Index for finding payroll by employee and date
EmployeePayrollSchema.index({ employeeId: 1, dateKey: 1 });

const EmployeePayroll = mongoose.model("EmployeePayroll", EmployeePayrollSchema);
export default EmployeePayroll;
