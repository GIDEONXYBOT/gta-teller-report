import express from "express";
import Deployment from "../models/Deployment.js";
import User from "../models/User.js";
import DailyTellerAssignment from "../models/DailyTellerAssignment.js";
import TellerReport from "../models/TellerReport.js";
import Payroll from "../models/Payroll.js";
import SystemSettings from "../models/SystemSettings.js";
import { DateTime } from "luxon";
import { protect, declaratorOnly, adminOrDeclarator } from "../middleware/authMiddleware.js";
import QRCode from "qrcode";

const router = express.Router();

// ==========================================
// DEPLOYMENT MANAGEMENT ROUTES
// ==========================================

/**
 * GET /api/deployments - Get all deployments (admin/declarator only)
 */
router.get("/", protect, adminOrDeclarator, async (req, res) => {
  try {
    const { status, priority, overdue, tellerId, search, dateFrom, dateTo, declaratorId, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    
    let filter = {};
    
    // Filter by status if provided
    if (status) {
      filter.status = status;
    }
    
    // Filter by priority if provided
    if (priority) {
      filter.priority = priority;
    }
    
    // Filter by teller if provided
    if (tellerId) {
      filter["assignedTellers.tellerId"] = tellerId;
    }
    
    // Filter by declarator if provided
    if (declaratorId) {
      filter.declaratorId = declaratorId;
    }
    
    // Date range filter
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo);
    }
    
    // Search functionality
    if (search) {
      filter.$or = [
        { itemName: { $regex: search, $options: 'i' } },
        { itemDescription: { $regex: search, $options: 'i' } },
        { notes: { $regex: search, $options: 'i' } },
        { 'assignedTellers.tellerName': { $regex: search, $options: 'i' } }
      ];
    }
    
    // If supervisor, restrict to today's assigned tellers (daily team) and optional report history
    if (req.user.role === "supervisor") {
      const today = DateTime.now().setZone("Asia/Manila").toFormat("yyyy-MM-dd");
      const assignments = await DailyTellerAssignment.find({ dayKey: today, supervisorId: req.user._id })
        .select("tellerId")
        .lean();
      const allowedSet = new Set(assignments.map(a => String(a.tellerId)));

      // Optional history inclusion: ?history=true&from=YYYY-MM-DD&to=YYYY-MM-DD
      if (String(req.query.history).toLowerCase() === "true") {
        const to = req.query.to || today;
        const from = req.query.from || DateTime.fromFormat(to, "yyyy-MM-dd").minus({ days: 30 }).toFormat("yyyy-MM-dd");
        const historyTellerIds = await TellerReport.distinct("tellerId", {
          supervisorId: req.user._id,
          date: { $gte: from, $lte: to },
        });
        historyTellerIds.forEach(id => allowedSet.add(String(id)));
      }

      // If a specific tellerId is requested, intersect with allowed
      let finalAllowed = Array.from(allowedSet);
      if (tellerId) {
        finalAllowed = finalAllowed.filter(id => String(id) === String(tellerId));
      }

      if (finalAllowed.length === 0) {
        return res.json({ success: true, count: 0, data: [] });
      }

      filter["assignedTellers.tellerId"] = { $in: finalAllowed };
    }

    // Build sort object
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

    let deployments = await Deployment.find(filter)
      .populate("declaratorId", "username name")
      .populate("assignedTellers.tellerId", "username name")
      .populate("tellerCompleteness.tellerId", "username name")
      .sort(sortOptions);
    
    // Filter overdue items if requested
    if (overdue === "true") {
      deployments = deployments.filter(deployment => {
        if (deployment.status === 'returned') return false;
        return new Date() > deployment.expectedReturnDate;
      });
    }
    
    // Add computed fields for better UX
    deployments = deployments.map(deployment => {
      const isOverdue = deployment.status !== 'returned' && new Date() > deployment.expectedReturnDate;
      const daysOverdue = isOverdue ? Math.floor((new Date() - deployment.expectedReturnDate) / (1000 * 60 * 60 * 24)) : 0;
      const daysUntilDue = !isOverdue ? Math.floor((deployment.expectedReturnDate - new Date()) / (1000 * 60 * 60 * 24)) : 0;
      
      return {
        ...deployment.toObject(),
        isOverdue,
        daysOverdue,
        daysUntilDue,
        returnRate: deployment.tellerCompleteness.length > 0 ? 
          (deployment.tellerCompleteness.filter(t => t.returned).length / deployment.tellerCompleteness.length * 100).toFixed(1) : 0
      };
    });
    
    res.json({
      success: true,
      count: deployments.length,
      data: deployments,
      summary: {
        total: deployments.length,
        active: deployments.filter(d => d.status === 'active').length,
        returned: deployments.filter(d => d.status === 'returned').length,
        overdue: deployments.filter(d => d.isOverdue).length,
        highPriority: deployments.filter(d => d.priority === 'high').length
      }
    });
    
  } catch (error) {
    console.error("❌ Error fetching deployments:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/deployments/:id - Get specific deployment
 */
router.get("/:id", protect, adminOrDeclarator, async (req, res) => {
  try {
    const deployment = await Deployment.findById(req.params.id)
      .populate("declaratorId", "username name")
      .populate("assignedTellers.tellerId", "username name")
      .populate("tellerCompleteness.tellerId", "username name");
    
    if (!deployment) {
      return res.status(404).json({ success: false, message: "Deployment not found" });
    }

    // If supervisor, ensure this deployment involves their daily team today
    if (req.user.role === "supervisor") {
      const today = DateTime.now().setZone("Asia/Manila").toFormat("yyyy-MM-dd");
      const assignments = await DailyTellerAssignment.find({ dayKey: today, supervisorId: req.user._id })
        .select("tellerId")
        .lean();
      const tellerSet = new Set(assignments.map(a => String(a.tellerId)));
      // Optionally include history range
      if (String(req.query.history).toLowerCase() === "true") {
        const to = req.query.to || today;
        const from = req.query.from || DateTime.fromFormat(to, "yyyy-MM-dd").minus({ days: 30 }).toFormat("yyyy-MM-dd");
        const historyTellerIds = await TellerReport.distinct("tellerId", {
          supervisorId: req.user._id,
          date: { $gte: from, $lte: to },
        });
        historyTellerIds.forEach(id => tellerSet.add(String(id)));
      }
      const permitted = (deployment.assignedTellers || []).some(t => tellerSet.has(String(t.tellerId)));
      if (!permitted) {
        return res.status(403).json({ success: false, message: "Access denied" });
      }
    }
    
    res.json({ success: true, data: deployment });
    
  } catch (error) {
    console.error("❌ Error fetching deployment:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/deployments - Create new deployment (declarator only)
 */
router.post("/", protect, declaratorOnly, async (req, res) => {
  try {
    const {
      itemType,
      itemName,
      itemDescription,
      quantity,
      expectedReturnDate,
      assignedTellerIds,
      priority,
      notes
    } = req.body;
    
    // Validate required fields
    if (!itemType || !itemName || !expectedReturnDate || !assignedTellerIds || assignedTellerIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: itemType, itemName, expectedReturnDate, assignedTellerIds"
      });
    }
    
    // Get teller information
    const tellers = await User.find({
      _id: { $in: assignedTellerIds },
      role: "teller",
      status: "approved"
    });
    
    if (tellers.length !== assignedTellerIds.length) {
      return res.status(400).json({
        success: false,
        message: "Some teller IDs are invalid or not approved"
      });
    }
    
    // Create deployment
    const deployment = new Deployment({
      itemType,
      itemName,
      itemDescription: itemDescription || "",
      quantity: quantity || 1,
      declaratorId: req.user._id,
      expectedReturnDate: new Date(expectedReturnDate),
      priority: priority || "medium",
      notes: notes || "",
      assignedTellers: tellers.map(teller => ({
        tellerId: teller._id,
        tellerName: teller.name || teller.username,
      })),
      tellerCompleteness: tellers.map(teller => ({
        tellerId: teller._id,
        tellerName: teller.name || teller.username,
      }))
    });
    
    await deployment.save();
    
    // Populate the response
    const populatedDeployment = await Deployment.findById(deployment._id)
      .populate("declaratorId", "username name")
      .populate("assignedTellers.tellerId", "username name")
      .populate("tellerCompleteness.tellerId", "username name");
    
    res.status(201).json({ success: true, data: populatedDeployment });
    
  } catch (error) {
    console.error("❌ Error creating deployment:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * PUT /api/deployments/:id - Update deployment
 */
router.put("/:id", protect, declaratorOnly, async (req, res) => {
  try {
    const deployment = await Deployment.findById(req.params.id);
    
    if (!deployment) {
      return res.status(404).json({ success: false, message: "Deployment not found" });
    }
    
    // Only allow declarator who created it to update
    if (deployment.declaratorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }
    
    const allowedUpdates = [
      'itemDescription', 'quantity', 'expectedReturnDate', 'priority', 
      'notes', 'status', 'returnCondition'
    ];
    
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        deployment[field] = req.body[field];
      }
    });
    
    await deployment.save();
    
    const updatedDeployment = await Deployment.findById(deployment._id)
      .populate("declaratorId", "username name")
      .populate("assignedTellers.tellerId", "username name")
      .populate("tellerCompleteness.tellerId", "username name");
    
    res.json({ success: true, data: updatedDeployment });
    
  } catch (error) {
    console.error("❌ Error updating deployment:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/deployments/:id/deploy - Mark deployment as deployed
 */
router.post("/:id/deploy", protect, declaratorOnly, async (req, res) => {
  try {
    const deployment = await Deployment.findById(req.params.id);
    
    if (!deployment) {
      return res.status(404).json({ success: false, message: "Deployment not found" });
    }
    
    if (deployment.declaratorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }
    
    deployment.status = "deployed";
    deployment.deployedAt = new Date();
    
    await deployment.save();
    
    res.json({ success: true, message: "Deployment marked as deployed" });
    
  } catch (error) {
    console.error("❌ Error deploying:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/deployments/:id/acknowledge - Teller acknowledges receipt
 */
router.post("/:id/acknowledge", protect, async (req, res) => {
  try {
    const deployment = await Deployment.findById(req.params.id);
    
    if (!deployment) {
      return res.status(404).json({ success: false, message: "Deployment not found" });
    }
    
    const tellerIndex = deployment.assignedTellers.findIndex(
      teller => teller.tellerId.toString() === req.user._id.toString()
    );
    
    if (tellerIndex === -1) {
      return res.status(403).json({ success: false, message: "You are not assigned to this deployment" });
    }
    
    deployment.assignedTellers[tellerIndex].acknowledged = true;
    deployment.assignedTellers[tellerIndex].acknowledgedAt = new Date();
    
    await deployment.save();
    
    res.json({ success: true, message: "Deployment acknowledged" });
    
  } catch (error) {
    console.error("❌ Error acknowledging deployment:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/deployments/:id/complete - Mark teller task as complete
 */
router.post("/:id/complete", protect, async (req, res) => {
  try {
    const { notes } = req.body;
    
    const deployment = await Deployment.findById(req.params.id);
    
    if (!deployment) {
      return res.status(404).json({ success: false, message: "Deployment not found" });
    }
    
    const tellerIndex = deployment.tellerCompleteness.findIndex(
      teller => teller.tellerId.toString() === req.user._id.toString()
    );
    
    if (tellerIndex === -1) {
      return res.status(403).json({ success: false, message: "You are not assigned to this deployment" });
    }
    
    deployment.tellerCompleteness[tellerIndex].isComplete = true;
    deployment.tellerCompleteness[tellerIndex].verifiedAt = new Date();
    deployment.tellerCompleteness[tellerIndex].notes = notes || "";
    
    await deployment.save();
    
    res.json({ success: true, message: "Task marked as complete" });
    
  } catch (error) {
    console.error("❌ Error completing task:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/deployments/:id/return - Mark deployment as returned
 */
router.post("/:id/return", protect, declaratorOnly, async (req, res) => {
  try {
    const { returnCondition, notes } = req.body;
    
    const deployment = await Deployment.findById(req.params.id);
    
    if (!deployment) {
      return res.status(404).json({ success: false, message: "Deployment not found" });
    }
    
    if (deployment.declaratorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }
    
    deployment.status = "returned";
    deployment.actualReturnDate = new Date();
    deployment.returnCondition = returnCondition || "good";
    if (notes) deployment.notes = deployment.notes + "\n\nReturn notes: " + notes;
    
    await deployment.save();
    
    res.json({ success: true, message: "Deployment marked as returned" });
    
  } catch (error) {
    console.error("❌ Error returning deployment:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/deployments/:id/assets - Add asset items to a deployment (declarator)
 */
router.post("/:id/assets", protect, declaratorOnly, async (req, res) => {
  try {
    const { items } = req.body; // array of { type, label, serialNumber, quantity }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: "Items array required" });
    }
    const deployment = await Deployment.findById(req.params.id);
    if (!deployment) return res.status(404).json({ success: false, message: "Deployment not found" });
    if (deployment.declaratorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }
    // Push items
    items.forEach(it => {
      deployment.items.push({
        type: it.type || 'other',
        label: it.label || 'Unnamed',
        serialNumber: it.serialNumber || '',
        quantity: it.quantity || 1,
        status: 'assigned',
        deployedAt: deployment.deployedAt || new Date(),
      });
    });
    await deployment.save();
    res.json({ success: true, message: 'Items added', data: deployment.items });
  } catch (error) {
    console.error('❌ Error adding assets:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/deployments/:id/assets - List asset items
 */
router.get("/:id/assets", protect, async (req, res) => {
  try {
    const deployment = await Deployment.findById(req.params.id);
    if (!deployment) return res.status(404).json({ success: false, message: "Deployment not found" });
    // Supervisors can only view assets for deployments involving their daily team
    if (req.user.role === "supervisor") {
      const today = DateTime.now().setZone("Asia/Manila").toFormat("yyyy-MM-dd");
      const assignments = await DailyTellerAssignment.find({ dayKey: today, supervisorId: req.user._id })
        .select("tellerId")
        .lean();
      const tellerSet = new Set(assignments.map(a => String(a.tellerId)));
      // Optionally include history range
      if (String(req.query.history).toLowerCase() === "true") {
        const to = req.query.to || today;
        const from = req.query.from || DateTime.fromFormat(to, "yyyy-MM-dd").minus({ days: 30 }).toFormat("yyyy-MM-dd");
        const historyTellerIds = await TellerReport.distinct("tellerId", {
          supervisorId: req.user._id,
          date: { $gte: from, $lte: to },
        });
        historyTellerIds.forEach(id => tellerSet.add(String(id)));
      }
      const permitted = (deployment.assignedTellers || []).some(t => tellerSet.has(String(t.tellerId)));
      if (!permitted) {
        return res.status(403).json({ success: false, message: "Access denied" });
      }
    }
    res.json({ success: true, data: deployment.items || [] });
  } catch (error) {
    console.error('❌ Error listing assets:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/deployments/:id/assets/:assetId/qr - Generate QR code (data URL)
 */
router.get("/:id/assets/:assetId/qr", protect, async (req, res) => {
  try {
    const deployment = await Deployment.findById(req.params.id);
    if (!deployment) return res.status(404).json({ success: false, message: "Deployment not found" });
    const asset = deployment.items.find(i => i.assetId === req.params.assetId);
    if (!asset) return res.status(404).json({ success: false, message: "Asset not found" });
    const payload = JSON.stringify({ d: deployment._id.toString(), a: asset.assetId, s: asset.qrSeed });
    const scaleParam = Math.max(4, Math.min(12, Number(req.query.scale) || 8));
    const qrDataUrl = await QRCode.toDataURL(payload, { errorCorrectionLevel: 'M', margin: 1, scale: scaleParam });
    res.json({ success: true, data: { assetId: asset.assetId, qr: qrDataUrl } });
  } catch (error) {
    console.error('❌ Error generating QR:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/deployments/:id/assets/:assetId/return - Return single asset via manual or QR scan
 */
router.post("/:id/assets/:assetId/return", protect, declaratorOnly, async (req, res) => {
  try {
    const { condition, damageNotes } = req.body;
    const deployment = await Deployment.findById(req.params.id).populate('declaratorId', 'username name role');
    if (!deployment) return res.status(404).json({ success: false, message: "Deployment not found" });
    const asset = deployment.items.find(i => i.assetId === req.params.assetId);
    if (!asset) return res.status(404).json({ success: false, message: "Asset not found" });
    if (asset.status === 'returned') {
      return res.json({ success: true, message: 'Asset already returned' });
    }
    asset.status = condition === 'damaged' ? 'damaged' : (condition === 'lost' ? 'lost' : 'returned');
    asset.returnedAt = new Date();
    asset.conditionOnReturn = condition || 'good';
    if (damageNotes) asset.damageNotes = damageNotes;
    deployment.updateReturnStatus();
    await deployment.save();
    
    // ✅ AUTO-CREATE PAYROLL FOR DECLARATOR WHEN ALL ITEMS ARE RETURNED
    const allItemsReturned = deployment.items.every(item => 
      item.status === 'returned' || item.status === 'damaged' || item.status === 'lost'
    );
    
    if (allItemsReturned && deployment.declaratorId) {
      try {
        const declarator = deployment.declaratorId;
        const today = DateTime.now().setZone("Asia/Manila").startOf('day').toJSDate();
        
        // Check if payroll already exists for today
        const existingPayroll = await Payroll.findOne({
          user: declarator._id,
          createdAt: {
            $gte: today,
            $lt: DateTime.now().setZone("Asia/Manila").endOf('day').toJSDate()
          }
        });
        
        if (!existingPayroll) {
          // Get declarator's daily rate from system settings
          const settings = await SystemSettings.findOne();
          const declaratorRate = settings?.salaryRates?.declarator || 500; // Default 500 if not set
          
          // Create payroll
          const newPayroll = new Payroll({
            user: declarator._id,
            role: declarator.role || 'declarator',
            baseSalary: declaratorRate,
            totalSalary: declaratorRate,
            deduction: 0,
            over: 0,
            short: 0,
            daysPresent: 1,
            approved: false,
            locked: false,
            note: `Auto-generated: All items returned from deployment ${deployment.deploymentId || deployment._id}`
          });
          
          await newPayroll.save();
          console.log(`✅ Auto-created payroll for declarator ${declarator.username} - ₱${declaratorRate}`);
        } else {
          console.log(`ℹ️ Payroll already exists for declarator ${declarator.username} today`);
        }
      } catch (payrollError) {
        console.error('❌ Error creating declarator payroll:', payrollError);
        // Don't fail the asset return if payroll creation fails
      }
    }
    
    res.json({ 
      success: true, 
      message: 'Asset return recorded', 
      data: asset,
      allItemsReturned,
      payrollCreated: allItemsReturned
    });
  } catch (error) {
    console.error('❌ Error returning asset:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/deployments/bulk-return - Bulk return multiple deployments
 */
router.post("/bulk-return", protect, declaratorOnly, async (req, res) => {
  try {
    const { deploymentIds, returnNotes } = req.body;
    
    if (!deploymentIds || !Array.isArray(deploymentIds) || deploymentIds.length === 0) {
      return res.status(400).json({ success: false, message: "deploymentIds array required" });
    }
    
    const results = [];
    let successCount = 0;
    let errorCount = 0;
    
    for (const deploymentId of deploymentIds) {
      try {
        const deployment = await Deployment.findById(deploymentId);
        if (!deployment) {
          results.push({ deploymentId, success: false, error: "Deployment not found" });
          errorCount++;
          continue;
        }
        
        // Mark all items as returned
        deployment.items.forEach(item => {
          if (item.status !== 'returned') {
            item.status = 'returned';
            item.returnedAt = new Date();
            item.conditionOnReturn = 'good';
          }
        });
        
        deployment.status = 'returned';
        deployment.returnedAt = new Date();
        deployment.returnNotes = returnNotes || deployment.returnNotes;
        
        await deployment.save();
        results.push({ deploymentId, success: true });
        successCount++;
        
      } catch (err) {
        results.push({ deploymentId, success: false, error: err.message });
        errorCount++;
      }
    }
    
    // Emit update
    if (req.app && req.app.io) {
      req.app.io.emit("deploymentUpdated");
    }
    
    res.json({
      success: true,
      message: `Bulk return completed: ${successCount} successful, ${errorCount} failed`,
      results,
      successCount,
      errorCount
    });
    
  } catch (error) {
    console.error("❌ Bulk return error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/deployments/bulk-update-status - Bulk update deployment status
 */
router.post("/bulk-update-status", protect, adminOrDeclarator, async (req, res) => {
  try {
    const { deploymentIds, newStatus, notes } = req.body;
    
    if (!deploymentIds || !Array.isArray(deploymentIds) || deploymentIds.length === 0) {
      return res.status(400).json({ success: false, message: "deploymentIds array required" });
    }
    
    if (!newStatus || !['active', 'returned', 'cancelled'].includes(newStatus)) {
      return res.status(400).json({ success: false, message: "Valid newStatus required: active, returned, or cancelled" });
    }
    
    const results = [];
    let successCount = 0;
    let errorCount = 0;
    
    for (const deploymentId of deploymentIds) {
      try {
        const deployment = await Deployment.findById(deploymentId);
        if (!deployment) {
          results.push({ deploymentId, success: false, error: "Deployment not found" });
          errorCount++;
          continue;
        }
        
        deployment.status = newStatus;
        if (newStatus === 'returned') {
          deployment.returnedAt = new Date();
        }
        if (notes) {
          deployment.notes = notes;
        }
        
        await deployment.save();
        results.push({ deploymentId, success: true });
        successCount++;
        
      } catch (err) {
        results.push({ deploymentId, success: false, error: err.message });
        errorCount++;
      }
    }
    
    // Emit update
    if (req.app && req.app.io) {
      req.app.io.emit("deploymentUpdated");
    }
    
    res.json({
      success: true,
      message: `Bulk status update completed: ${successCount} successful, ${errorCount} failed`,
      results,
      successCount,
      errorCount
    });
    
  } catch (error) {
    console.error("❌ Bulk status update error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/deployments/export - Export deployments to CSV
 */
router.get("/export", protect, adminOrDeclarator, async (req, res) => {
  try {
    const { status, priority, overdue, tellerId, search, dateFrom, dateTo, declaratorId } = req.query;
    
    let filter = {};
    
    // Apply same filters as main GET route
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (tellerId) filter["assignedTellers.tellerId"] = tellerId;
    if (declaratorId) filter.declaratorId = declaratorId;
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo);
    }
    if (search) {
      filter.$or = [
        { itemName: { $regex: search, $options: 'i' } },
        { itemDescription: { $regex: search, $options: 'i' } },
        { notes: { $regex: search, $options: 'i' } },
        { 'assignedTellers.tellerName': { $regex: search, $options: 'i' } }
      ];
    }
    
    // Apply supervisor restrictions if needed
    if (req.user.role === "supervisor") {
      const today = DateTime.now().setZone("Asia/Manila").toFormat("yyyy-MM-dd");
      const assignments = await DailyTellerAssignment.find({ dayKey: today, supervisorId: req.user._id })
        .select("tellerId")
        .lean();
      const allowedSet = new Set(assignments.map(a => String(a.tellerId)));
      filter["assignedTellers.tellerId"] = { $in: Array.from(allowedSet) };
    }
    
    const deployments = await Deployment.find(filter)
      .populate("declaratorId", "username name")
      .populate("assignedTellers.tellerId", "username name")
      .populate("tellerCompleteness.tellerId", "username name")
      .sort({ createdAt: -1 });
    
    // Generate CSV
    let csv = 'ID,Item Name,Item Type,Status,Priority,Declarator,Assigned Tellers,Expected Return,Actual Return,Overdue Days,Notes\n';
    
    deployments.forEach(deployment => {
      const declaratorName = deployment.declaratorId?.name || deployment.declaratorId?.username || '';
      const tellerNames = deployment.assignedTellers?.map(t => t.tellerName).join('; ') || '';
      const expectedReturn = deployment.expectedReturnDate ? new Date(deployment.expectedReturnDate).toISOString().split('T')[0] : '';
      const actualReturn = deployment.returnedAt ? new Date(deployment.returnedAt).toISOString().split('T')[0] : '';
      const isOverdue = deployment.status !== 'returned' && new Date() > deployment.expectedReturnDate;
      const daysOverdue = isOverdue ? Math.floor((new Date() - deployment.expectedReturnDate) / (1000 * 60 * 60 * 24)) : 0;
      
      csv += `"${deployment._id}","${deployment.itemName}","${deployment.itemType}","${deployment.status}","${deployment.priority}","${declaratorName}","${tellerNames}","${expectedReturn}","${actualReturn}","${daysOverdue}","${deployment.notes || ''}"\n`;
    });
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="deployments-export.csv"');
    res.send(csv);
    
  } catch (error) {
    console.error("❌ Export error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/deployments/stats/dashboard - Get dashboard statistics
 */
router.get("/stats/dashboard", protect, adminOrDeclarator, async (req, res) => {
  try {
    const stats = await Promise.all([
      Deployment.countDocuments({ status: "deployed" }),
      Deployment.countDocuments({ status: "returned" }),
      Deployment.countDocuments({ 
        expectedReturnDate: { $lt: new Date() }, 
        status: { $nin: ["returned"] }
      }),
      Deployment.countDocuments({ allTellersComplete: false }),
      Deployment.countDocuments({ priority: "urgent" })
    ]);
    
    res.json({
      success: true,
      data: {
        totalDeployed: stats[0],
        totalReturned: stats[1],
        overdue: stats[2],
        pendingCompletion: stats[3],
        urgent: stats[4]
      }
    });
    
  } catch (error) {
    console.error("❌ Error fetching stats:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/deployments/teller/assigned - Get teller's assigned deployments
 */
router.get("/teller/assigned", protect, async (req, res) => {
  try {
    if (req.user.role !== "teller") {
      return res.status(403).json({ success: false, message: "Tellers only" });
    }
    
    const deployments = await Deployment.find({
      "assignedTellers.tellerId": req.user._id
    })
      .populate("declaratorId", "username name")
      .sort({ createdAt: -1 });
    
    res.json({ success: true, data: deployments });
    
  } catch (error) {
    console.error("❌ Error fetching teller deployments:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;