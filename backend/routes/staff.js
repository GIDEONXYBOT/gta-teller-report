import express from "express";
import Employee from "../models/Employee.js";
import EmployeePayroll from "../models/EmployeePayroll.js";
import { DateTime } from "luxon";

const router = express.Router();

// Get all staff employees (non-teller, non-supervisor)
router.get("/", async (req, res) => {
  try {
    const employees = await Employee.find().sort({ createdAt: -1 });
    res.json(employees);
  } catch (err) {
    console.error("Error fetching employees:", err);
    res.status(500).json({ message: "Failed to fetch employees" });
  }
});

// Get single employee
router.get("/:id", async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }
    res.json(employee);
  } catch (err) {
    console.error("Error fetching employee:", err);
    res.status(500).json({ message: "Failed to fetch employee" });
  }
});

// Create new employee
router.post("/", async (req, res) => {
  try {
    const { name, position, dailySalary } = req.body;
    
    if (!name || !position) {
      return res.status(400).json({ message: "Name and position are required" });
    }

    const employee = new Employee({
      name,
      position,
      dailySalary: dailySalary || 0,
      status: "active"
    });

    await employee.save();
    res.status(201).json(employee);
  } catch (err) {
    console.error("Error creating employee:", err);
    res.status(500).json({ message: "Failed to create employee" });
  }
});

// Update employee
router.put("/:id", async (req, res) => {
  try {
    const { name, position, dailySalary, status } = req.body;
    
    const employee = await Employee.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    if (name) employee.name = name;
    if (position) employee.position = position;
    if (dailySalary !== undefined) employee.dailySalary = dailySalary;
    if (status) employee.status = status;

    await employee.save();
    res.json(employee);
  } catch (err) {
    console.error("Error updating employee:", err);
    res.status(500).json({ message: "Failed to update employee" });
  }
});

// Delete employee
router.delete("/:id", async (req, res) => {
  try {
    const employee = await Employee.findByIdAndDelete(req.params.id);
    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }
    res.json({ message: "Employee deleted successfully" });
  } catch (err) {
    console.error("Error deleting employee:", err);
    res.status(500).json({ message: "Failed to delete employee" });
  }
});

// ========== PAYROLL ROUTES ==========

// Get employee payroll records (with optional date filter)
router.get("/:id/payroll", async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const query = { employeeId: req.params.id };
    
    if (startDate && endDate) {
      query.dateKey = { 
        $gte: startDate, 
        $lte: endDate 
      };
    }

    const payrolls = await EmployeePayroll.find(query).sort({ dateKey: -1 });
    res.json(payrolls);
  } catch (err) {
    console.error("Error fetching employee payroll:", err);
    res.status(500).json({ message: "Failed to fetch payroll records" });
  }
});

// Add manual payroll for employee
router.post("/:id/payroll", async (req, res) => {
  try {
    const { amount, dateKey, notes, createdBy } = req.body;
    
    if (!amount || !dateKey) {
      return res.status(400).json({ message: "Amount and date are required" });
    }

    const employee = await Employee.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    // Check if payroll already exists for this date
    const existing = await EmployeePayroll.findOne({
      employeeId: req.params.id,
      dateKey: dateKey
    });

    if (existing) {
      return res.status(400).json({ 
        message: "Payroll already exists for this employee on this date" 
      });
    }

    const payroll = new EmployeePayroll({
      employeeId: employee._id,
      employeeName: employee.name,
      position: employee.position,
      amount,
      dateKey,
      notes: notes || "",
      createdBy: createdBy || "admin"
    });

    await payroll.save();
    res.status(201).json(payroll);
  } catch (err) {
    console.error("Error adding employee payroll:", err);
    res.status(500).json({ message: "Failed to add payroll" });
  }
});

// Update employee payroll
router.put("/payroll/:payrollId", async (req, res) => {
  try {
    const { amount, notes } = req.body;
    
    const payroll = await EmployeePayroll.findById(req.params.payrollId);
    if (!payroll) {
      return res.status(404).json({ message: "Payroll record not found" });
    }

    if (amount !== undefined) payroll.amount = amount;
    if (notes !== undefined) payroll.notes = notes;

    await payroll.save();
    res.json(payroll);
  } catch (err) {
    console.error("Error updating payroll:", err);
    res.status(500).json({ message: "Failed to update payroll" });
  }
});

// Delete employee payroll
router.delete("/payroll/:payrollId", async (req, res) => {
  try {
    const payroll = await EmployeePayroll.findByIdAndDelete(req.params.payrollId);
    if (!payroll) {
      return res.status(404).json({ message: "Payroll record not found" });
    }
    res.json({ message: "Payroll record deleted successfully" });
  } catch (err) {
    console.error("Error deleting payroll:", err);
    res.status(500).json({ message: "Failed to delete payroll" });
  }
});

// Get all employee payroll for a specific date (for admin overview)
router.get("/payroll/date/:dateKey", async (req, res) => {
  try {
    const payrolls = await EmployeePayroll.find({ 
      dateKey: req.params.dateKey 
    }).sort({ employeeName: 1 });
    res.json(payrolls);
  } catch (err) {
    console.error("Error fetching payroll by date:", err);
    res.status(500).json({ message: "Failed to fetch payroll records" });
  }
});

export default router;
