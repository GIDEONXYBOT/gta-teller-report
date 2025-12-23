import { body, param, validationResult } from 'express-validator';

// Validation middleware to handle errors
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(error => ({
        field: error.path,
        message: error.msg,
        value: error.value
      }))
    });
  }
  next();
};

// Common validation rules
export const ValidationRules = {
  // User registration validation
  registerUser: [
    body('username')
      .trim()
      .isLength({ min: 3, max: 20 })
      .withMessage('Username must be between 3 and 20 characters')
      .matches(/^[a-zA-Z0-9_-]+$/)
      .withMessage('Username can only contain letters, numbers, hyphens, and underscores'),
    
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters long'),
    
    body('name')
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage('Name must be between 2 and 50 characters')
      .matches(/^[a-zA-Z\s.-]+$/)
      .withMessage('Name can only contain letters, spaces, periods, and hyphens'),
    
    body('role')
      .isIn(['admin', 'supervisor', 'teller', 'supervisor_teller'])
      .withMessage('Invalid role selected')
  ],

  // Login validation
  loginUser: [
    body('username')
      .trim()
      .notEmpty()
      .withMessage('Username is required'),
    
    body('password')
      .notEmpty()
      .withMessage('Password is required')
  ],

  // Teller report validation
  tellerReport: [
    body('tellerId')
      .isMongoId()
      .withMessage('Invalid teller ID'),
    
    body('startingCapital')
      .isFloat({ min: 0 })
      .withMessage('Starting capital must be a positive number'),
    
    body('endingCapital')
      .isFloat({ min: 0 })
      .withMessage('Ending capital must be a positive number'),
    
    body('totalSales')
      .isFloat({ min: 0 })
      .withMessage('Total sales must be a positive number'),
    
    body('totalRemittance')
      .isFloat({ min: 0 })
      .withMessage('Total remittance must be a positive number'),
    
    body('date')
      .isISO8601()
      .toDate()
      .withMessage('Invalid date format')
  ],

  // Capital management validation
  addCapital: [
    body('tellerId')
      .isMongoId()
      .withMessage('Invalid teller ID'),
    
    body('supervisorId')
      .isMongoId()
      .withMessage('Invalid supervisor ID'),
    
    body('amount')
      .isFloat({ min: 0.01, max: 1000000 })
      .withMessage('Amount must be between ₱0.01 and ₱1,000,000'),
    
    body('note')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Note must not exceed 500 characters')
  ],

  // Transaction validation
  createTransaction: [
    body('supervisorId')
      .isMongoId()
      .withMessage('Invalid supervisor ID'),
    
    body('tellerId')
      .isMongoId()
      .withMessage('Invalid teller ID'),
    
    body('type')
      .isIn(['starting', 'additional', 'remittance'])
      .withMessage('Transaction type must be starting, additional, or remittance'),
    
    body('amount')
      .isFloat({ min: 0.01 })
      .withMessage('Amount must be a positive number')
  ],

  // Payroll validation
  updatePayroll: [
    body('userId')
      .isMongoId()
      .withMessage('Invalid user ID'),
    
    body('baseSalary')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Base salary must be a positive number'),
    
    body('short')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Short amount must be a positive number'),
    
    body('over')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Over amount must be a positive number'),
    
    body('terms')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Terms must be a positive integer')
  ],

  // Settings validation
  updateSettings: [
    body('siteName')
      .optional()
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('Site name must be between 1 and 100 characters'),
    
    body('baseSalary')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Base salary must be a positive number'),
    
    body('timezone')
      .optional()
      .matches(/^[A-Za-z_\/]+$/)
      .withMessage('Invalid timezone format')
  ],

  // MongoDB ID validation
  mongoId: [
    param('id')
      .isMongoId()
      .withMessage('Invalid ID format')
  ]
};

// Quick validation helper for common patterns
export const quickValidation = {
  isPositiveNumber: (value) => !isNaN(value) && Number(value) > 0,
  isValidEmail: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
  isValidUsername: (value) => /^[a-zA-Z0-9_-]{3,20}$/.test(value),
  isValidName: (value) => /^[a-zA-Z\s.-]{2,50}$/.test(value)
};

// Sanitization helpers
export const sanitizeInput = {
  trim: (str) => typeof str === 'string' ? str.trim() : str,
  toLower: (str) => typeof str === 'string' ? str.toLowerCase() : str,
  toNumber: (val) => {
    const num = Number(val);
    return isNaN(num) ? 0 : num;
  },
  limitLength: (str, max = 255) => {
    if (typeof str !== 'string') return str;
    return str.length > max ? str.substring(0, max) : str;
  }
};