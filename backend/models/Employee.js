import mongoose from "mongoose";

const EmployeeSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true,
    trim: true 
  },
  position: { 
    type: String, 
    enum: ["Watcher", "Sub-watcher", "Assistant Admin", "Monton"],
    required: true 
  },
  dailySalary: { 
    type: Number, 
    default: 0 
  },
  status: { 
    type: String, 
    enum: ["active", "inactive"], 
    default: "active" 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

const Employee = mongoose.model("Employee", EmployeeSchema);
export default Employee;
