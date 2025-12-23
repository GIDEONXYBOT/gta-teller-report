import cron from "node-cron";
import Config from "../models/Config.js";
import DailyTellerAssignment from "../models/DailyTellerAssignment.js";
import AuditLog from "../models/AuditLog.js";
import { DateTime } from "luxon";

/**
 * Starts a scheduler that runs daily at configured reset hour/minute (timezone aware).
 * The job currently writes an audit log entry indicating reset occurred.
 *
 * Call startScheduler() after DB connected.
 */

let task = null;

export const startScheduler = async () => {
  // read config
  const cfg = (await Config.findOne()) || { resetHour: 0, resetMinute: 0, timezone: "Asia/Manila" };

  // build cron expression
  // Cron format: minute hour day month weekday
  const cronExpr = `${cfg.resetMinute || 0} ${cfg.resetHour || 0} * * *`;

  // stop previous task
  if (task) task.stop();

  task = cron.schedule(cronExpr, async () => {
    try {
      // We do not delete assignments - we just record that reset occurred.
      const now = DateTime.now().setZone(cfg.timezone || "Asia/Manila");
      const prevDayKey = now.minus({ days: 1 }).toFormat("yyyy-MM-dd");

      await AuditLog.create({
        actorName: "system",
        actionType: "daily_reset",
        data: { executedAt: now.toISO(), prevDayKey },
      });

      console.log("✅ Daily reset executed at", now.toISO());
    } catch (err) {
      console.error("❌ Scheduler error:", err);
    }
  }, {
    scheduled: true,
    timezone: cfg.timezone || "Asia/Manila",
  });

  console.log(`Scheduler started: cron="${cronExpr}" timezone="${cfg.timezone}"`);
};

export const stopScheduler = () => {
  if (task) task.stop();
};
