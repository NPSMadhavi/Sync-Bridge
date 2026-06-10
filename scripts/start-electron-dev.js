import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import net from 'net';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function to check if a port is in use
function isPortInUse(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close();
      resolve(false);
    });
    server.on('error', () => {
      resolve(true);
    });
  });
}

// Function to wait for a port to be available
async function waitForPort(port, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    if (await isPortInUse(port)) {
      console.log(`Port ${port} is in use, waiting...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    } else {
      return true;
    }
  }
  return false;
}

// Start backend server
console.log('🚀 Starting backend server...');
const backend = spawn('npm', ['run', 'dev'], {
  cwd: path.join(__dirname, '..'),
  stdio: 'inherit',
  shell: true,
});

backend.on('error', (error) => {
  console.error('Backend error:', error);
});

// Wait for backend to start
setTimeout(async () => {
  console.log('⚡ Starting frontend server...');
  const frontend = spawn('npx', ['vite'], {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit',
    shell: true,
  });

  frontend.on('error', (error) => {
    console.error('Frontend error:', error);
  });

  // Wait for frontend to start
  setTimeout(() => {
    console.log('⚡ Launching Electron...');
    const electron = spawn('npx', ['electron', path.join(__dirname, '..', 'main.cjs')], {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit',
      shell: true,
    });

    electron.on('error', (error) => {
      console.error('Electron error:', error);
    });

    // Handle process termination
    process.on('SIGINT', () => {
      console.log('Shutting down...');
      backend.kill();
      frontend.kill();
      electron.kill();
      process.exit(0);
    });
  }, 5000);
}, 5000); 