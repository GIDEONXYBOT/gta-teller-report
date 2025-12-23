const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
let autoUpdater = null;
let mainWindow = null;  // Global mainWindow variable
try {
  const updater = require('electron-updater');
  autoUpdater = updater.autoUpdater;
} catch (err) {
  console.warn('electron-updater not available, auto-updates disabled');
}
const path = require('path');
const fs = require('fs');

const isDev = process.env.NODE_ENV !== 'production';

const createWindow = () => {
  try {
    mainWindow = new BrowserWindow({
      width: 1200,
      height: 820,
      minWidth: 940,
      minHeight: 680,
      show: false,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        enableRemoteModule: false
      }
    });

    mainWindow.once('ready-to-show', () => {
      console.log('✅ Window ready to show');
      mainWindow.show();
      mainWindow.focus();
      // Open DevTools in development for debugging
      if (isDev) {
        mainWindow.webContents.openDevTools();
      }
    });

    // Fallback: force show if ready-to-show doesn't fire within 3 seconds
    const showTimeout = setTimeout(() => {
      if (mainWindow && !mainWindow.isVisible()) {
        console.log('⚠️ Forcing window show (ready-to-show timeout)');
        mainWindow.show();
        mainWindow.focus();
      }
    }, 3000);

    // Clear timeout when window is finally shown
    mainWindow.once('show', () => {
      clearTimeout(showTimeout);
    });

    // Handle window closed
    mainWindow.on('closed', () => {
      console.log('Main window closed');
    });

    // Handle any errors during page load
    mainWindow.webContents.on('crashed', () => {
      console.error('❌ App crashed!');
      dialog.showErrorBox('Error', 'Application crashed. Please restart.');
    });

    const distPath = path.join(__dirname, '..', 'frontend', 'dist', 'index.html');
    if (fs.existsSync(distPath)) {
      console.log('📂 Loading from local dist:', distPath);
      mainWindow.loadFile(distPath, { hash: 'admin/dashboard' });
    } else {
      console.log('🌐 Loading from remote URL');
      mainWindow.loadURL('https://rmi.gideonbot.xyz/#/admin/dashboard');
    }

    // Log any errors
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      console.error('❌ Failed to load:', errorCode, errorDescription);
    });

    // Setup updater for this window
    setupUpdater(mainWindow);
  } catch (err) {
    console.error('❌ Error creating window:', err);
    process.exit(1);
  }
};

const printHtml = async (html, selectedPrinter) => {
  const printWindow = new BrowserWindow({
    width: 340,
    height: 660,
    show: false
  });

  await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

  return new Promise((resolve) => {
    // Get available printers
    printWindow.webContents.getPrinters().then((printers) => {
      console.log('📱 Available printers:', printers.map(p => p.name));
      
      let deviceName = '';
      
      // Use selected printer if provided
      if (selectedPrinter && selectedPrinter.name) {
        deviceName = selectedPrinter.name;
        console.log(`🖨️  Using selected printer: ${deviceName}`);
      } else {
        // Try to find 58mm thermal printer (common names: "58mm", "Thermal", "Receipt", etc.)
        const thermalKeywords = ['58', 'thermal', 'receipt', 'tsc', 'xprinter', 'deli', 'esc', 'pos', 'label'];
        let thermalPrinter = printers.find(p => 
          thermalKeywords.some(keyword => p.name.toLowerCase().includes(keyword))
        );
        
        // Fallback: use default printer if available
        if (!thermalPrinter) {
          console.warn('⚠️  No thermal printer found, using default printer');
          thermalPrinter = printers.find(p => p.isDefault);
        }
        
        // Last resort: use first printer
        if (!thermalPrinter && printers.length > 0) {
          console.warn('⚠️  Using first available printer');
          thermalPrinter = printers[0];
        }
        
        deviceName = thermalPrinter?.name || '';
        console.log(`🖨️  Printing to: ${deviceName || '(system default)'}`);
      }

      printWindow.webContents.print(
        {
          silent: true,
          printBackground: true,
          deviceName: deviceName,
          pageSize: 'A6', // 58mm width approximation
          margins: {
            marginType: 'none'
          }
        },
        (success, failureReason) => {
          if (success) {
            console.log('✅ Print sent to thermal printer');
          } else {
            console.error('❌ Print failed:', failureReason);
          }
          printWindow.close();
          resolve({ success, failureReason });
        }
      );
    }).catch(err => {
      console.error('Error getting printers:', err);
      // Fallback: just try to print anyway
      printWindow.webContents.print(
        {
          silent: true,
          printBackground: true,
          deviceName: '',
          pageSize: 'A6'
        },
        (success, failureReason) => {
          printWindow.close();
          resolve({ success, failureReason });
        }
      );
    });
  });
};

const getAvailablePrinters = async () => {
  const printWindow = new BrowserWindow({
    width: 300,
    height: 300,
    show: false
  });

  try {
    await printWindow.loadURL('about:blank');
    const printers = await printWindow.webContents.getPrinters();
    printWindow.close();
    
    console.log('📱 Retrieved printers:', printers.map(p => ({ name: p.name, isDefault: p.isDefault })));
    return printers;
  } catch (err) {
    console.error('Error getting printers:', err);
    printWindow.close();
    return [];
  }
};

ipcMain.handle('print-html', async (_, html, selectedPrinter) => {
  return printHtml(html, selectedPrinter);
});

ipcMain.handle('get-printers', async () => {
  return getAvailablePrinters();
});

// Configure auto-updater (only if available)
if (autoUpdater && !isDev) {
  autoUpdater.checkForUpdatesAndNotify();
  
  autoUpdater.on('update-available', () => {
    dialog.showMessageBox({
      type: 'info',
      title: 'Update Available',
      message: 'A new version of GTA Teller Report is available.',
      detail: 'The app will download and install the update automatically.',
      buttons: ['OK']
    });
  });

  autoUpdater.on('update-downloaded', () => {
    dialog.showMessageBox({
      type: 'info',
      title: 'Update Ready',
      message: 'Update downloaded. The app will restart to apply the changes.',
      buttons: ['Restart Now', 'Later']
    }).then(result => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  });
}

// Auto-updater setup
const setupUpdater = (window) => {
  if (!autoUpdater) {
    console.log('❌ electron-updater not available');
    return;
  }

  // Check for updates automatically every 10 minutes
  setInterval(() => {
    autoUpdater.checkForUpdates();
  }, 10 * 60 * 1000);

  autoUpdater.on('checking-for-update', () => {
    console.log('🔍 Checking for updates...');
    window.webContents.send('update-status', { status: 'checking' });
  });

  autoUpdater.on('update-available', (info) => {
    console.log('📦 Update available:', info.version);
    window.webContents.send('update-status', { status: 'available', version: info.version });
  });

  autoUpdater.on('update-not-available', () => {
    console.log('✅ App is up to date');
    window.webContents.send('update-status', { status: 'not-available' });
  });

  autoUpdater.on('error', (err) => {
    console.error('❌ Update error:', err);
    window.webContents.send('update-status', { status: 'error', error: err.message });
  });

  autoUpdater.on('download-progress', (progressObj) => {
    console.log(`📥 Download progress: ${Math.round(progressObj.percent)}%`);
    window.webContents.send('update-status', { 
      status: 'downloading', 
      percent: Math.round(progressObj.percent) 
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('✅ Update downloaded, ready to install');
    window.webContents.send('update-status', { status: 'ready', version: info.version });
  });
};

// IPC handlers for updates
ipcMain.handle('check-for-update', async () => {
  if (!autoUpdater) return { success: false, message: 'Updater not available' };
  try {
    const result = await autoUpdater.checkForUpdates();
    return { success: true, updateAvailable: result.updateInfo !== null };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('install-update', async () => {
  if (!autoUpdater) return { success: false };
  try {
    autoUpdater.quitAndInstall();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Create application menu with Help menu
const createMenu = () => {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Exit',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Check for Updates',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('trigger-update-check');
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Developer Tools',
          accelerator: 'F12',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.toggleDevTools();
            }
          }
        },
        { type: 'separator' },
        {
          label: 'About GTA Teller Report',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About GTA Teller Report',
              message: 'GTA Teller Report',
              detail: `Version: ${app.getVersion()}\n\nManage and calculate teller salaries efficiently.`
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
};

app.whenReady().then(() => {
  console.log('🚀 App ready, creating window...');
  createMenu();
  createWindow();
}).catch(err => {
  console.error('❌ App error:', err);
  process.exit(1);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

