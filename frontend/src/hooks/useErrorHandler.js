import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

export const useErrorHandler = () => {
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const handleError = useCallback((error, context = '') => {
    console.error(`Error ${context}:`, error);

    let userMessage = 'An unexpected error occurred. Please try again.';
    let shouldRedirect = false;

    if (error.response) {
      // Server responded with error status
      const status = error.response.status;
      const data = error.response.data;

      switch (status) {
        case 401:
          userMessage = 'Your session has expired. Please login again.';
          shouldRedirect = true;
          localStorage.removeItem('user');
          localStorage.removeItem('token');
          break;
        case 403:
          userMessage = 'You do not have permission to perform this action.';
          break;
        case 404:
          userMessage = 'The requested resource was not found.';
          break;
        case 429:
          userMessage = 'Too many requests. Please wait a moment and try again.';
          break;
        case 500:
          userMessage = 'Server error. Please try again later or contact support.';
          break;
        default:
          userMessage = data?.message || data?.error || userMessage;
      }
    } else if (error.request) {
      // Network error
      userMessage = 'Network error. Please check your internet connection and try again.';
    } else if (error.message) {
      // Other error
      userMessage = error.message;
    }

    setError(userMessage);

    // Auto-redirect if authentication error
    if (shouldRedirect) {
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    }

    // Auto-clear error after 5 seconds
    setTimeout(() => {
      setError(null);
    }, 5000);

    return userMessage;
  }, [navigate]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return { error, handleError, clearError };
};

// Error display component
export const ErrorDisplay = ({ error, onClose }) => {
  if (!error) return null;

  return (
    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
      <span className="block sm:inline">{error}</span>
      {onClose && (
        <span 
          className="absolute top-0 bottom-0 right-0 px-4 py-3 cursor-pointer"
          onClick={onClose}
        >
          <svg className="fill-current h-6 w-6 text-red-500" role="button" viewBox="0 0 20 20">
            <title>Close</title>
            <path d="M14.348 5.652a1 1 0 0 0-1.414 0L10 8.586 7.066 5.652a1 1 0 1 0-1.414 1.414L8.586 10l-2.934 2.934a1 1 0 1 0 1.414 1.414L10 11.414l2.934 2.934a1 1 0 0 0 1.414-1.414L11.414 10l2.934-2.934a1 1 0 0 0 0-1.414z"/>
          </svg>
        </span>
      )}
    </div>
  );
};

// Success message component
export const SuccessDisplay = ({ message, onClose }) => {
  if (!message) return null;

  return (
    <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4" role="alert">
      <span className="block sm:inline">{message}</span>
      {onClose && (
        <span 
          className="absolute top-0 bottom-0 right-0 px-4 py-3 cursor-pointer"
          onClick={onClose}
        >
          <svg className="fill-current h-6 w-6 text-green-500" role="button" viewBox="0 0 20 20">
            <title>Close</title>
            <path d="M14.348 5.652a1 1 0 0 0-1.414 0L10 8.586 7.066 5.652a1 1 0 1 0-1.414 1.414L8.586 10l-2.934 2.934a1 1 0 1 0 1.414 1.414L10 11.414l2.934 2.934a1 1 0 0 0 1.414-1.414L11.414 10l2.934-2.934a1 1 0 0 0 0-1.414z"/>
          </svg>
        </span>
      )}
    </div>
  );
};

// Loading component
export const LoadingSpinner = ({ size = 'md', message = 'Loading...' }) => {
  const sizeClasses = {
    sm: 'h-6 w-6',
    md: 'h-12 w-12',
    lg: 'h-16 w-16',
    xl: 'h-24 w-24'
  };

  return (
    <div className="flex flex-col items-center justify-center p-8">
      <div className={`animate-spin rounded-full border-b-2 border-indigo-600 ${sizeClasses[size]}`}></div>
      {message && (
        <p className="mt-4 text-gray-600 dark:text-gray-400">{message}</p>
      )}
    </div>
  );
};