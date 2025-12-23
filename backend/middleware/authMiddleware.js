import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import User from "../models/User.js";

dotenv.config();

/**
 * Middleware to verify JWT tokens for protected routes
 */
export const protect = async (req, res, next) => {
  let token;

  // Tokens are expected in headers like: Authorization: Bearer <token>
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      token = req.headers.authorization.split(" ")[1];

      // Verify the token
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || "your_secret_key"
      );

      // Attach user info to request
      req.user = await User.findById(decoded.id).select("-password");

      if (!req.user)
        return res.status(404).json({ message: "User not found (invalid token)" });

      next();
    } catch (error) {
      console.error("❌ Token verification failed:", error);
      return res.status(401).json({ message: "Invalid or expired token" });
    }
  } else {
    return res.status(401).json({ message: "No token provided" });
  }
};

/**
 * Middleware to restrict route to admins only
 */
export const adminOnly = (req, res, next) => {
  if (req.user && (req.user.role === "admin" || req.user.role === "super_admin")) {
    next();
  } else {
    res.status(403).json({ message: "Access denied — Admins only" });
  }
};

/**
 * Middleware to restrict route to supervisors only
 */
export const supervisorOnly = (req, res, next) => {
  if (req.user && req.user.role === "supervisor") {
    next();
  } else {
    res.status(403).json({ message: "Access denied — Supervisors only" });
  }
};

/**
 * Middleware to restrict route to declarators only
 */
export const declaratorOnly = (req, res, next) => {
  if (req.user && req.user.role === "declarator") {
    next();
  } else {
    res.status(403).json({ message: "Access denied — Declarators only" });
  }
};

/**
 * Middleware to allow admins and declarators
 */
export const adminOrDeclarator = (req, res, next) => {
  if (
    req.user && (
      req.user.role === "admin" ||
      req.user.role === "declarator" ||
      req.user.role === "super_admin" ||
      req.user.role === "supervisor"
    )
  ) {
    next();
  } else {
    res.status(403).json({ message: "Access denied — Admins or Declarators only" });
  }
};
