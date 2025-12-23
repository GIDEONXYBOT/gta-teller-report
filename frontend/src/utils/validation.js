// Form validation utilities

export const ValidationRules = {
  required: (value) => {
    if (value === null || value === undefined || value === '') {
      return 'This field is required';
    }
    return null;
  },

  email: (value) => {
    if (!value) return null; // Only validate if value exists
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      return 'Please enter a valid email address';
    }
    return null;
  },

  minLength: (min) => (value) => {
    if (!value) return null;
    if (value.length < min) {
      return `Must be at least ${min} characters long`;
    }
    return null;
  },

  maxLength: (max) => (value) => {
    if (!value) return null;
    if (value.length > max) {
      return `Must be no more than ${max} characters long`;
    }
    return null;
  },

  username: (value) => {
    if (!value) return null;
    if (value.length < 3) {
      return 'Username must be at least 3 characters long';
    }
    if (value.length > 20) {
      return 'Username must be no more than 20 characters long';
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
      return 'Username can only contain letters, numbers, hyphens, and underscores';
    }
    return null;
  },

  password: (value) => {
    if (!value) return null;
    if (value.length < 6) {
      return 'Password must be at least 6 characters long';
    }
    return null;
  },

  confirmPassword: (password) => (value) => {
    if (!value) return null;
    if (value !== password) {
      return 'Passwords do not match';
    }
    return null;
  },

  number: (value) => {
    if (!value) return null;
    if (isNaN(Number(value))) {
      return 'Please enter a valid number';
    }
    return null;
  },

  positiveNumber: (value) => {
    if (!value) return null;
    const num = Number(value);
    if (isNaN(num) || num < 0) {
      return 'Please enter a positive number';
    }
    return null;
  },

  currency: (value) => {
    if (!value) return null;
    const num = Number(value);
    if (isNaN(num) || num < 0) {
      return 'Please enter a valid amount';
    }
    if (num > 1000000) {
      return 'Amount cannot exceed ₱1,000,000';
    }
    return null;
  },

  name: (value) => {
    if (!value) return null;
    if (value.length < 2) {
      return 'Name must be at least 2 characters long';
    }
    if (value.length > 50) {
      return 'Name must be no more than 50 characters long';
    }
    if (!/^[a-zA-Z\s.-]+$/.test(value)) {
      return 'Name can only contain letters, spaces, periods, and hyphens';
    }
    return null;
  }
};

// Validation utility function
export const validateField = (value, rules) => {
  for (const rule of rules) {
    const error = rule(value);
    if (error) {
      return error;
    }
  }
  return null;
};

// Validate entire form
export const validateForm = (formData, validationSchema) => {
  const errors = {};
  let hasErrors = false;

  Object.keys(validationSchema).forEach(field => {
    const fieldError = validateField(formData[field], validationSchema[field]);
    if (fieldError) {
      errors[field] = fieldError;
      hasErrors = true;
    }
  });

  return { errors, hasErrors };
};

// Form validation hook
import { useState, useCallback } from 'react';

export const useFormValidation = (initialValues, validationSchema) => {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateSingleField = useCallback((name, value) => {
    if (!validationSchema[name]) return null;
    return validateField(value, validationSchema[name]);
  }, [validationSchema]);

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setValues(prev => ({ ...prev, [name]: value }));
    
    // Clear error when user starts typing
    if (touched[name] && errors[name]) {
      const fieldError = validateSingleField(name, value);
      setErrors(prev => ({ ...prev, [name]: fieldError }));
    }
  }, [touched, errors, validateSingleField]);

  const handleBlur = useCallback((e) => {
    const { name, value } = e.target;
    setTouched(prev => ({ ...prev, [name]: true }));
    
    // Validate field on blur
    const fieldError = validateSingleField(name, value);
    setErrors(prev => ({ ...prev, [name]: fieldError }));
  }, [validateSingleField]);

  const validateAll = useCallback(() => {
    const { errors: allErrors, hasErrors } = validateForm(values, validationSchema);
    setErrors(allErrors);
    setTouched(Object.keys(validationSchema).reduce((acc, key) => {
      acc[key] = true;
      return acc;
    }, {}));
    return !hasErrors;
  }, [values, validationSchema]);

  const reset = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
    setIsSubmitting(false);
  }, [initialValues]);

  return {
    values,
    errors,
    touched,
    isSubmitting,
    handleChange,
    handleBlur,
    validateAll,
    setIsSubmitting,
    reset,
    setValues
  };
};

// Input field component with validation
export const ValidatedInput = ({
  name,
  label,
  type = 'text',
  value,
  onChange,
  onBlur,
  error,
  touched,
  required = false,
  placeholder = '',
  className = '',
  ...props
}) => {
  return (
    <div className={`mb-4 ${className}`}>
      <label 
        htmlFor={name}
        className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300"
      >
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        placeholder={placeholder}
        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors
          ${error && touched ? 'border-red-500 bg-red-50' : 'border-gray-300'}
          ${props.disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}
          dark:bg-gray-700 dark:border-gray-600 dark:text-white`}
        {...props}
      />
      {error && touched && (
        <p className="text-red-500 text-xs mt-1">{error}</p>
      )}
    </div>
  );
};

// Select field component with validation
export const ValidatedSelect = ({
  name,
  label,
  value,
  onChange,
  onBlur,
  error,
  touched,
  required = false,
  options = [],
  placeholder = 'Select an option...',
  className = '',
  ...props
}) => {
  return (
    <div className={`mb-4 ${className}`}>
      <label 
        htmlFor={name}
        className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300"
      >
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <select
        id={name}
        name={name}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors
          ${error && touched ? 'border-red-500 bg-red-50' : 'border-gray-300'}
          ${props.disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}
          dark:bg-gray-700 dark:border-gray-600 dark:text-white`}
        {...props}
      >
        <option value="">{placeholder}</option>
        {options.map((option, index) => (
          <option key={index} value={option.value || option}>
            {option.label || option}
          </option>
        ))}
      </select>
      {error && touched && (
        <p className="text-red-500 text-xs mt-1">{error}</p>
      )}
    </div>
  );
};