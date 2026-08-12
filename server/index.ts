import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { config } from 'dotenv';
import { join } from 'path';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '.env') });

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { setupAuth } from "./auth";
import { dataProtectionMiddleware } from "./middleware/data-protection";
import { whenSchemaReady } from "./db";

const app = express();

// Basic middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));
app.use(cors({
  origin: ['http://localhost:5000', 'http://localhost:5173'],
  credentials: true
}));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Set up authentication before routes
setupAuth(app);

// Set up data protection middleware
app.use(dataProtectionMiddleware());

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Initialize background jobs only after DB schema patches complete
  setTimeout(() => {
    void whenSchemaReady().then(() => {
      import('./document-expiry-notifier').then(({ initializeDocumentExpiryMonitoring }) => {
        initializeDocumentExpiryMonitoring();
        console.log("Document expiry monitoring initialized");
      }).catch(error => {
        console.warn("Document expiry monitoring not available:", error.message);
      });
      import('./employee-document-reminder-service').then(({ initializeEmployeeDocumentReminderMonitoring }) => {
        initializeEmployeeDocumentReminderMonitoring();
        console.log("Employee document reminder monitoring initialized");
      }).catch(error => {
        console.warn("Employee document reminder monitoring not available:", error.message);
      });
      import('./document-reminder-notification-sync').then(({ initializeDocumentReminderNotificationSync }) => {
        initializeDocumentReminderNotificationSync();
        console.log("Document reminder notification sync initialized");
      }).catch(error => {
        console.warn("Document reminder notification sync not available:", error.message);
      });
      import('./scheduled-expiry-reminder-service').then(({ initializeScheduledExpiryReminders }) => {
        initializeScheduledExpiryReminders();
        console.log("Scheduled expiry reminder service initialized");
      }).catch(error => {
        console.warn("Scheduled expiry reminder service not available:", error.message);
      });
    });
  }, 10000);

  // Register routes
  const server = await registerRoutes(app);

  // Error handling middleware
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // Use Vite when running `npm run dev` (even if .env has NODE_ENV=production),
  // or when Express env is development. Otherwise serve the built client.
  const useViteDev =
    process.env.npm_lifecycle_event === "dev" ||
    app.get("env") === "development";
  if (useViteDev) {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Use PORT from environment or default to 5000
  const port = process.env.PORT ? parseInt(process.env.PORT) : 5000;
  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.error(`\nPort ${port} is already in use. Stop the other server first:`);
      console.error(`  npm run predev`);
      console.error(`  or: powershell -File scripts/free-port-5000.ps1\n`);
      process.exit(1);
    }
    throw err;
  });
  server.listen(port, () => {
    console.log(`🚀 Server running on port ${port}`);
    console.log(`📱 Environment: ${app.get("env")}`);
    console.log(`🔗 API: http://localhost:${port}/api`);
    console.log(`🌐 Web: http://localhost:${port}`);
  });
})(); 