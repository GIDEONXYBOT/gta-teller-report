import MenuPermission from '../models/MenuPermission.js';

/**
 * requirePermission(permissionKey)
 * - Allows super_admin automatically
 * - Otherwise checks MenuPermission for the user's role and verifies permissionKey is present
 */
export const requirePermission = (permissionKey) => {
  return async (req, res, next) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
      // super_admin bypass
      if (req.user.role === 'super_admin') return next();

      // read permissions for this role
      const perm = await MenuPermission.findOne({ role: req.user.role }).lean();
      if (!perm || !Array.isArray(perm.menuItems)) return res.status(403).json({ message: 'Forbidden - no menu permissions' });

      // If permissionKey present in role's allowed menu items, allow
      if (perm.menuItems.includes(permissionKey)) return next();

      return res.status(403).json({ message: 'Forbidden - insufficient permissions' });
    } catch (err) {
      console.error('Permission check failed', err);
      return res.status(500).json({ message: 'Permission check failed' });
    }
  };
};

export default requirePermission;
