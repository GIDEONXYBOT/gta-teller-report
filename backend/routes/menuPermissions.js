import express from "express";
import { requireAuth, requireRole } from '../middleware/auth.js';
import MenuPermission from "../models/MenuPermission.js";

const router = express.Router();

/**
 * GET /api/menu-permissions
 * Get all menu permissions for all roles
 */
router.get("/", async (req, res) => {
  try {
    let permissions = await MenuPermission.find().lean();
    // Normalize legacy alias 'approvals' -> 'user-approval' to avoid duplicate menu ids
    permissions = permissions.map(p => {
      const items = Array.isArray(p.menuItems) ? p.menuItems.map(id => id === 'approvals' ? 'user-approval' : id) : [];
      return { ...p, menuItems: Array.from(new Set(items)) };
    });
    res.json(permissions);
  } catch (err) {
    console.error("Error fetching menu permissions:", err);
    res.status(500).json({ message: "Failed to load menu permissions" });
  }
});

/**
 * GET /api/menu-permissions/:role
 * Get menu permissions for a specific role
 */
router.get("/:role", async (req, res) => {
  try {
    const { role } = req.params;
    let permission = await MenuPermission.findOne({ role }).lean();
    
    // If no permission exists, return default empty array
    if (!permission) {
      permission = { role, menuItems: [] };
    } else {
      // Normalize legacy alias 'approvals' -> 'user-approval'
      const items = Array.isArray(permission.menuItems) ? permission.menuItems.map(id => id === 'approvals' ? 'user-approval' : id) : [];
      permission.menuItems = Array.from(new Set(items));
    }
    
    res.json(permission);
  } catch (err) {
    console.error("Error fetching menu permission:", err);
    res.status(500).json({ message: "Failed to load menu permission" });
  }
});

/**
 * PUT /api/menu-permissions/:role
 * Update menu permissions for a specific role (super_admin only)
 */
router.put("/:role", requireAuth, requireRole(['super_admin']), async (req, res) => {
  try {
    const { role } = req.params;
    const { menuItems, updatedBy } = req.body;

    if (!menuItems || !Array.isArray(menuItems)) {
      return res.status(400).json({ message: "menuItems must be an array" });
    }

    // Normalize aliases & deduplicate before upsert
    const normalizedItems = Array.from(new Set((menuItems || []).map(id => id === 'approvals' ? 'user-approval' : id)));
    // Upsert the permission record
    const permission = await MenuPermission.findOneAndUpdate(
      { role },
      {
        role,
        menuItems: normalizedItems,
        updatedBy: updatedBy || "super_admin",
      },
      { upsert: true, new: true }
    );

    // Emit socket event for real-time update
    if (req.app && req.app.io) {
      req.app.io.emit("menuPermissionsUpdated", { role });
    }

    res.json({
      message: "Menu permissions updated successfully",
      permission,
    });
  } catch (err) {
    console.error("Error updating menu permissions:", err);
    res.status(500).json({ message: "Failed to update menu permissions" });
  }
});

/**
 * POST /api/menu-permissions/initialize
 * Initialize default permissions for all roles (run once)
 */
router.post("/initialize", requireAuth, requireRole(['super_admin']), async (req, res) => {
  try {
    const defaultPermissions = [
      // Admin starts with minimal set - full control belongs to super_admin
      { role: 'admin', menuItems: ['dashboard', 'chicken-fight-results'] },
      { role: 'supervisor', menuItems: ['dashboard', 'teller-salary-calculation', 'chicken-fight-results'] },
      { role: 'teller', menuItems: ['dashboard'] },
      { role: 'supervisor_teller', menuItems: ['dashboard'] },
      { role: 'declarator', menuItems: ['chicken-fight-results'] },
      { role: 'super_admin', menuItems: [
          "dashboard",
          "supervisor-report",
          "teller-reports",
          "teller-reports-viewer",
          "teller-management",
          "teller-overview",
          "report",
          "cashflow",
          "user-approval",
          "withdrawals",
          "employees",
          "salary",
          "suggested-schedule",
          "attendance-scheduler",
          "payroll",
          "payroll-management",
          "teller-salary-calculation",
          "history",
          "teller-month",
          "assistant",
          "menu-config",
          "manage-sidebars",
          "settings",
          "financial-summary",
          "chicken-fight-results"
        ] },
    ];

    for (const perm of defaultPermissions) {
      await MenuPermission.findOneAndUpdate(
        { role: perm.role },
        { ...perm, updatedBy: "system-init" },
        { upsert: true }
      );
    }

    res.json({
      message: "Default menu permissions initialized",
      count: defaultPermissions.length,
    });
  } catch (err) {
    console.error("Error initializing menu permissions:", err);
    res.status(500).json({ message: "Failed to initialize menu permissions" });
  }
});

export default router;
