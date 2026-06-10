const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const isDev = process.env.NODE_ENV === 'development';

let mainWindow;

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.cjs')
    },
    show: false,
  });

  // Determine the start URL
  let startUrl;
  if (app.isPackaged) {
    // In production, load from the bundled dist/public directory
    const indexPath = path.join(__dirname, 'dist', 'public', 'index.html');
    if (fs.existsSync(indexPath)) {
      startUrl = `file://${indexPath}`;
      console.log('Loading production build from:', startUrl);
    } else {
      console.error('Production build not found at:', indexPath);
      // Fallback to development URL
      startUrl = 'http://localhost:5000';
    }
  } else {
    // Development mode
    startUrl = 'http://localhost:5000';
    console.log('Loading development build from:', startUrl);
  }

  console.log('Loading URL:', startUrl);
  
  // Load the URL with error handling
  mainWindow.loadURL(startUrl).then(() => {
    console.log('Successfully loaded URL');
  }).catch((error) => {
    console.error('Failed to load URL:', error);
    // Show error in window
    mainWindow.loadURL(`data:text/html,
      <html>
        <body style="font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5;">
          <h2>SyncBridge Loading Error</h2>
          <p>Failed to load the application: ${error.message}</p>
          <p>Please ensure the application is properly built.</p>
          <button onclick="window.location.reload()" style="padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">Retry</button>
        </body>
      </html>
    `);
  });

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    console.log('Window is ready and shown');
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Open DevTools in development
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  // Handle page load errors
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('Page load failed:', {
      errorCode,
      errorDescription,
      validatedURL
    });
  });
}

// App event listeners
app.whenReady().then(() => {
  console.log('Electron app is ready');
  createWindow();
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

// Security: Prevent new window creation
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event, navigationUrl) => {
    event.preventDefault();
  });
});
