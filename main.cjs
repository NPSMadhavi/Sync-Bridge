const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');

let mainWindow;
let backendProcess;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.cjs')
    }
  });

  // Determine the start URL based on environment
  let startUrl;
  if (app.isPackaged) {
    // In production, load from the backend server which serves the built frontend files
    startUrl = 'http://localhost:5000';
    console.log('✅ Loading production build from backend server:', startUrl);
  } else {
    // In development, load from the development server
    startUrl = 'http://localhost:5000';
    console.log('🔄 Loading development build from:', startUrl);
  }

  console.log('Loading UI:', startUrl);
  
  mainWindow.loadURL(startUrl).then(() => {
    console.log('✅ UI loaded successfully');
  }).catch((error) => {
    console.error('❌ Failed to load UI:', error);
    // Show error page
    mainWindow.loadURL(`data:text/html,
      <html>
        <head><title>SyncBridge - Loading Error</title></head>
        <body style="font-family: Arial, sans-serif; padding: 20px; text-align: center;">
          <h1>SyncBridge</h1>
          <p>Error loading application: ${error.message}</p>
          <button onclick="window.location.reload()" style="padding: 10px 20px; margin: 10px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">Retry</button>
        </body>
      </html>
    `);
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    console.log('✅ Window is ready and shown');
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (backendProcess) {
      console.log('🛑 Stopping backend process');
      backendProcess.kill();
    }
  });
}

// Function to check if backend is ready
function checkBackendHealth() {
  return new Promise((resolve) => {
    const req = http.get('http://localhost:5000/health', (res) => {
      if (res.statusCode === 200) {
        console.log('✅ Backend health check passed');
        resolve(true);
      } else {
        console.log('⚠️ Backend health check failed with status:', res.statusCode);
        resolve(false);
      }
    });
    
    req.on('error', (err) => {
      console.log('⚠️ Backend health check error:', err.message);
      resolve(false);
    });
    
    req.setTimeout(2000, () => {
      console.log('⚠️ Backend health check timeout');
      req.destroy();
      resolve(false);
    });
  });
}

function startBackend() {
  if (!app.isPackaged) {
    console.log('🔄 Development mode: Backend should be started separately');
    return Promise.resolve(true);
  }

  console.log('🚀 Starting backend server...');
  
  // In production, use the unpacked files from resources
  const resourcesPath = process.resourcesPath;
  const backendPath = path.join(resourcesPath, 'app.asar.unpacked', 'server', 'dist', 'index.js');
  const envPath = path.join(resourcesPath, 'app.asar.unpacked', 'server', '.env');
  const nodeModulesPath = path.join(resourcesPath, 'app.asar.unpacked', 'node_modules');
  
  console.log('Resources path:', resourcesPath);
  console.log('Backend path:', backendPath);
  console.log('Environment file path:', envPath);
  console.log('Node modules path:', nodeModulesPath);
  
  // Check if backend file exists
  if (!fs.existsSync(backendPath)) {
    console.error('❌ Backend file not found:', backendPath);
    return Promise.resolve(false);
  }
  
  // Set up environment variables with fallbacks
  const env = {
    ...process.env,
    NODE_ENV: 'production',
    PORT: '5000',
    NODE_PATH: nodeModulesPath, // Use unpacked node_modules path
    // Fallback database configuration
    DATABASE_URL: 'postgresql://postgres:Welcome123@localhost:5432/syncbridge',
    SESSION_SECRET: 'your-secure-session-secret',
    OPENAI_API_KEY: 'demo-key-not-used',
    // Email configuration fallbacks
    SMTP_HOST: 'smtp.example.com',
    SMTP_PORT: '587',
    SMTP_SECURE: 'false',
    SMTP_USER: 'your-smtp-username',
    SMTP_PASS: 'your-smtp-password',
    EMAIL_FROM: 'noreply@syncbridge.com'
  };

  // Load .env file if it exists
  if (fs.existsSync(envPath)) {
    console.log('✅ Found .env file, loading environment variables');
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        let value = valueParts.join('=').trim();
        // Remove quotes from the value
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
        } else if (value.startsWith("'") && value.endsWith("'")) {
          value = value.slice(1, -1);
        }
        if (value && !value.startsWith('#')) {
          env[key.trim()] = value;
        }
      }
    });
  } else {
    console.warn('⚠️ .env file not found, using fallback environment variables');
  }

  return new Promise((resolve) => {
    try {
      // Start the backend server
      backendProcess = spawn('node', [backendPath], {
        env: env,
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: false
      });

      // Handle backend output
      backendProcess.stdout.on('data', (data) => {
        console.log('Backend:', data.toString().trim());
      });

      backendProcess.stderr.on('data', (data) => {
        console.error('Backend Error:', data.toString().trim());
      });

      backendProcess.on('close', (code) => {
        console.log(`Backend process exited with code ${code}`);
      });

      backendProcess.on('error', (error) => {
        console.error('Failed to start backend:', error);
        resolve(false);
      });

      console.log('✅ Backend started successfully');
      
      // Wait for backend to be ready
      let attempts = 0;
      const maxAttempts = 30; // 30 seconds timeout
      
      const checkHealth = () => {
        attempts++;
        checkBackendHealth().then((isHealthy) => {
          if (isHealthy) {
            console.log('✅ Backend is ready and responding');
            resolve(true);
          } else if (attempts < maxAttempts) {
            console.log(`⏳ Backend not ready yet, attempt ${attempts}/${maxAttempts}`);
            setTimeout(checkHealth, 1000);
          } else {
            console.error('❌ Backend failed to start within timeout');
            resolve(false);
          }
        });
      };
      
      // Start checking after a short delay
      setTimeout(checkHealth, 2000);
      
    } catch (err) {
      console.error('❌ Failed to start backend:', err);
      resolve(false);
    }
  });
}

app.whenReady().then(async () => {
  console.log('🎯 Electron app is ready');
  
  // Start backend first (in production)
  if (app.isPackaged) {
    const backendReady = await startBackend();
    if (backendReady) {
      console.log('✅ Backend ready, creating window');
      createWindow();
    } else {
      console.error('❌ Backend failed to start, showing error');
      // Show error window
      const errorWindow = new BrowserWindow({
        width: 600,
        height: 400,
        show: true,
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false
        }
      });
      
      errorWindow.loadURL(`data:text/html,
        <html>
          <head><title>SyncBridge - Backend Error</title></head>
          <body style="font-family: Arial, sans-serif; padding: 20px; text-align: center;">
            <h1>SyncBridge</h1>
            <p>Error: Backend server failed to start.</p>
            <p>Please check your database connection and try again.</p>
            <button onclick="window.close()" style="padding: 10px 20px; margin: 10px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">Close</button>
          </body>
        </html>
      `);
    }
  } else {
    // In development, just create window
    createWindow();
  }
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

app.on('before-quit', () => {
  if (backendProcess) {
    console.log('🛑 Stopping backend process before quit');
    backendProcess.kill();
  }
});
