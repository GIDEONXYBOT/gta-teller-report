// Auto-reset teller-supervisor assignments daily
import cron from "node-cron";
import mongoose from "mongoose";
import User from "../models/User.js";
import SystemSettings from "../models/SystemSettings.js";

let resetTask = null;

/**
 * Clear all supervisorId assignments from tellers
 */
async function clearSupervisorAssignments() {
  try {
    console.log("🔄 Starting supervisor assignment reset...");
    
    const result = await User.updateMany(
      { role: { $in: ["teller", "supervisor_teller"] } },
      { $unset: { supervisorId: "" } }
    );
    
    console.log(`✅ Cleared supervisor assignments for ${result.modifiedCount} tellers`);
    
    // Emit socket event if available
    if (global.io) {
      global.io.emit("supervisorAssignmentsReset", { 
        timestamp: new Date(),
        count: result.modifiedCount 
      });
    }
  } catch (err) {
    console.error("❌ Error clearing supervisor assignments:", err);
  }
}

/**
 * Initialize the supervisor reset scheduler
 */
export async function initSupervisorResetScheduler() {
  try {
    // Wait for mongoose connection to be ready
    if (mongoose.connection.readyState !== 1) {
      console.log("⏳ Waiting for MongoDB connection before initializing scheduler...");
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("MongoDB connection timeout"));
        }, 10000); // 10 second timeout

        mongoose.connection.once('connected', () => {
          clearTimeout(timeout);
          resolve();
        });

        if (mongoose.connection.readyState === 1) {
          clearTimeout(timeout);
          resolve();
        }
      });
    }

    // Get current settings
    let settings = await SystemSettings.findOne();
    if (!settings) {
      settings = await SystemSettings.create({});
    }

    const { supervisorResetTime, autoResetSupervisorAssignments } = settings;

    if (!autoResetSupervisorAssignments) {
      console.log("⏸️  Supervisor assignment auto-reset is DISABLED");
      return;
    }

    // Parse time (format: "HH:MM")
    const [hour, minute] = supervisorResetTime.split(":").map(Number);

    // Stop existing task if any
    if (resetTask) {
      resetTask.stop();
    }

    // Schedule the task: "minute hour * * *"
    const cronExpression = `${minute} ${hour} * * *`;

    resetTask = cron.schedule(cronExpression, clearSupervisorAssignments, {
      scheduled: true,
      timezone: settings.timezone || "Asia/Manila"
    });

    console.log(`✅ Supervisor assignment reset scheduled at ${supervisorResetTime} (${settings.timezone})`);
  } catch (err) {
    console.error("❌ Error initializing supervisor reset scheduler:", err);
    // Don't throw error, just log it so server can continue
  }
}

/**
 * Stop the scheduler (for manual control)
 */
export function stopSupervisorResetScheduler() {
  if (resetTask) {
    resetTask.stop();
    console.log("⏹️  Supervisor assignment reset scheduler stopped");
  }
}

/**
 * Manually trigger reset (for testing or admin action)
 */
export async function manualResetSupervisorAssignments() {
  await clearSupervisorAssignments();
}

export default {
  initSupervisorResetScheduler,
  stopSupervisorResetScheduler,
  manualResetSupervisorAssignments
};
