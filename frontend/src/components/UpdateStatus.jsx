import React, { useState, useEffect } from 'react';
import { Download, CheckCircle, AlertCircle, Loader } from 'lucide-react';

export default function UpdateStatus() {
  const [updateStatus, setUpdateStatus] = useState(null);
  const [showNotification, setShowNotification] = useState(false);
  const isElectron = !!window?.electronAPI;

  useEffect(() => {
    if (!isElectron) return;

    // Listen for update status from main process
    window.electronAPI.onUpdateStatus((data) => {
      setUpdateStatus(data);
      if (data.status === 'available' || data.status === 'ready') {
        setShowNotification(true);
      }
    });

    // Listen for trigger update check from menu
    window.electronAPI.onTriggerUpdateCheck(() => {
      checkForUpdate();
    });
  }, []);

  const checkForUpdate = async () => {
    if (!window?.electronAPI?.checkForUpdate) return;
    
    setUpdateStatus({ status: 'checking' });
    setShowNotification(true);
    
    try {
      const result = await window.electronAPI.checkForUpdate();
      if (result.success) {
        if (!result.updateAvailable) {
          setUpdateStatus({ status: 'up-to-date' });
          setTimeout(() => setShowNotification(false), 3000);
        }
      } else {
        setUpdateStatus({ status: 'error', error: result.error });
      }
    } catch (err) {
      setUpdateStatus({ status: 'error', error: err.message });
    }
  };

  const installUpdate = async () => {
    if (!window?.electronAPI?.installUpdate) return;
    
    try {
      await window.electronAPI.installUpdate();
    } catch (err) {
      console.error('Install update failed:', err);
    }
  };

  if (!isElectron || !showNotification || !updateStatus) {
    return null;
  }

  const statusConfig = {
    checking: {
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      border: 'border-blue-200 dark:border-blue-800',
      icon: <Loader className="animate-spin" size={20} />,
      color: 'text-blue-700 dark:text-blue-300',
      title: 'Checking for updates...'
    },
    downloading: {
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      border: 'border-blue-200 dark:border-blue-800',
      icon: <Download size={20} />,
      color: 'text-blue-700 dark:text-blue-300',
      title: `Downloading update... ${updateStatus.percent || 0}%`
    },
    available: {
      bg: 'bg-amber-50 dark:bg-amber-900/20',
      border: 'border-amber-200 dark:border-amber-800',
      icon: <AlertCircle size={20} />,
      color: 'text-amber-700 dark:text-amber-300',
      title: `Update available: v${updateStatus.version}`,
      subtitle: 'Downloading in background...'
    },
    ready: {
      bg: 'bg-green-50 dark:bg-green-900/20',
      border: 'border-green-200 dark:border-green-800',
      icon: <CheckCircle size={20} />,
      color: 'text-green-700 dark:text-green-300',
      title: `Update ready: v${updateStatus.version}`,
      subtitle: 'Restart to install',
      action: true
    },
    'not-available': {
      bg: 'bg-green-50 dark:bg-green-900/20',
      border: 'border-green-200 dark:border-green-800',
      icon: <CheckCircle size={20} />,
      color: 'text-green-700 dark:text-green-300',
      title: 'App is up to date',
      autoClose: true
    },
    'up-to-date': {
      bg: 'bg-green-50 dark:bg-green-900/20',
      border: 'border-green-200 dark:border-green-800',
      icon: <CheckCircle size={20} />,
      color: 'text-green-700 dark:text-green-300',
      title: 'App is up to date',
      autoClose: true
    },
    error: {
      bg: 'bg-red-50 dark:bg-red-900/20',
      border: 'border-red-200 dark:border-red-800',
      icon: <AlertCircle size={20} />,
      color: 'text-red-700 dark:text-red-300',
      title: 'Update check failed',
      subtitle: updateStatus.error
    }
  };

  const config = statusConfig[updateStatus.status] || statusConfig.error;

  useEffect(() => {
    if (config.autoClose) {
      const timer = setTimeout(() => setShowNotification(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [updateStatus.status, config.autoClose]);

  return (
    <div className={`fixed bottom-6 right-6 p-4 rounded-lg border-2 ${config.bg} ${config.border} shadow-lg z-50 max-w-sm`}>
      <div className="flex items-start gap-3">
        <div className={`flex-shrink-0 ${config.color}`}>
          {config.icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className={`font-semibold ${config.color}`}>
            {config.title}
          </h3>
          {config.subtitle && (
            <p className={`text-sm ${config.color} opacity-80`}>
              {config.subtitle}
            </p>
          )}
          {updateStatus.status === 'downloading' && (
            <div className="mt-2 w-full bg-gray-300 dark:bg-gray-700 rounded-full h-1.5">
              <div
                className="bg-blue-600 h-1.5 rounded-full transition-all"
                style={{ width: `${updateStatus.percent || 0}%` }}
              />
            </div>
          )}
          {config.action && (
            <button
              onClick={installUpdate}
              className="mt-3 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded transition"
            >
              Restart & Install
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
