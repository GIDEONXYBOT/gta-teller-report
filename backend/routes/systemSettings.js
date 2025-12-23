import express from "express";
import SystemSettings from "../models/SystemSettings.js";
import User from "../models/User.js";
// import {
//   initSupervisorResetScheduler,
//   stopSupervisorResetScheduler,
//   manualResetSupervisorAssignments
// } from "../scheduler/supervisorReset.js";

const router = express.Router();

// Fetch system settings
router.get("/", async (req, res) => {
  try {
    let settings = await SystemSettings.findOne();
    if (!settings) {
      settings = new SystemSettings();
      await settings.save();
    }
    res.json(settings);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch settings", error: err });
  }
});

// Update settings
router.put("/", async (req, res) => {
  try {
    const { baseSalary, theme } = req.body;
    let settings = await SystemSettings.findOne();

    if (!settings) {
      settings = new SystemSettings({ baseSalary, theme });
    } else {
      if (baseSalary) {
        settings.baseSalary = baseSalary;
        
        // 🔄 Update all users' base salaries based on their role
        if (baseSalary.admin !== undefined) {
          await User.updateMany({ role: "admin" }, { baseSalary: Number(baseSalary.admin) });
        }
        if (baseSalary.supervisor !== undefined) {
          await User.updateMany({ role: "supervisor" }, { baseSalary: Number(baseSalary.supervisor) });
        }
        if (baseSalary.teller !== undefined) {
          await User.updateMany({ role: "teller" }, { baseSalary: Number(baseSalary.teller) });
        }
      }
      if (theme) settings.theme = theme;
      settings.lastUpdated = new Date();
    }

    await settings.save();
    res.json({ message: "✅ Settings updated successfully", settings });
  } catch (err) {
    res.status(500).json({ message: "Error updating settings", error: err });
  }
});

// Update supervisor reset scheduler settings
router.put("/supervisor-reset", async (req, res) => {
  try {
    const { supervisorResetTime, autoResetSupervisorAssignments } = req.body;
    
    let settings = await SystemSettings.findOne();
    if (!settings) {
      settings = new SystemSettings();
    }

    if (supervisorResetTime !== undefined) {
      settings.supervisorResetTime = supervisorResetTime;
    }
    if (autoResetSupervisorAssignments !== undefined) {
      settings.autoResetSupervisorAssignments = autoResetSupervisorAssignments;
    }
    
    settings.lastUpdated = new Date();
    await settings.save();

    // Restart scheduler with new settings
    // stopSupervisorResetScheduler();
    // if (settings.autoResetSupervisorAssignments) {
    //   await initSupervisorResetScheduler();
    // }

    res.json({ 
      message: "✅ Supervisor reset scheduler updated", 
      settings: {
        supervisorResetTime: settings.supervisorResetTime,
        autoResetSupervisorAssignments: settings.autoResetSupervisorAssignments
      }
    });
  } catch (err) {
    res.status(500).json({ message: "Error updating supervisor reset settings", error: err });
  }
});

// Manually trigger supervisor assignment reset
// router.post("/supervisor-reset/trigger", async (req, res) => {
//   try {
//     await manualResetSupervisorAssignments();
//     res.json({ message: "✅ Supervisor assignments cleared successfully" });
//   } catch (err) {
//     res.status(500).json({ message: "Error clearing supervisor assignments", error: err });
//   }
// });

// Update multiple reports per day setting
router.put("/multiple-reports", async (req, res) => {
  try {
    const { allowMultipleReportsPerDay } = req.body;
    
    let settings = await SystemSettings.findOne();
    if (!settings) {
      settings = new SystemSettings();
    }

    if (allowMultipleReportsPerDay !== undefined) {
      settings.allowMultipleReportsPerDay = allowMultipleReportsPerDay;
    }
    
    settings.lastUpdated = new Date();
    await settings.save();

    res.json({ 
      message: "✅ Multiple reports setting updated", 
      settings: {
        allowMultipleReportsPerDay: settings.allowMultipleReportsPerDay
      }
    });
  } catch (err) {
    res.status(500).json({ message: "Error updating multiple reports setting", error: err });
  }
});

export default router;
