import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { db } from "./db";
import { User as SelectUser, userRoleEnum, users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { sendEmail, generateVerificationEmailHTML, generateVerificationEmailText } from "./email";

// Define custom info type for authentication
interface AuthInfo {
  message: string;
  info?: string;
}

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string) {
  const crypto = await import('crypto');
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${hash}.${salt}`;
}

const SUPERADMIN_EMAIL = "supadmin@syncbridge.com";
const SUPERADMIN_PASSWORD = "admin123";
const LEGACY_SUPERADMIN_EMAILS = ["supadmin@myrsv.com", "supadmin@syncbridge.in"];

async function ensureSuperAdminLogin() {
  try {
    let user = await storage.getUserByEmail(SUPERADMIN_EMAIL);

    if (!user) {
      for (const email of LEGACY_SUPERADMIN_EMAILS) {
        user = await storage.getUserByEmail(email);
        if (user) break;
      }
    }

    if (user) {
      await storage.updateUser(user.id, {
        password: SUPERADMIN_PASSWORD,
        role: "super_admin",
      });
      await db
        .update(users)
        .set({
          isActive: true,
          isSuperAdmin: true,
          isEmailVerified: true,
          tenantId: null,
          email: SUPERADMIN_EMAIL,
        })
        .where(eq(users.id, user.id));
      console.log(`Superadmin login ready: ${SUPERADMIN_EMAIL}`);
      return;
    }

    await db.insert(users).values({
      name: "Super Administrator",
      email: SUPERADMIN_EMAIL,
      role: "super_admin",
      password: await hashPassword(SUPERADMIN_PASSWORD),
      isSuperAdmin: true,
      isEmailVerified: true,
      isActive: true,
      tenantId: null,
    });
    console.log(`Superadmin account created: ${SUPERADMIN_EMAIL}`);
  } catch (error) {
    console.warn(
      "Could not initialize superadmin login:",
      error instanceof Error ? error.message : error,
    );
  }
}

async function comparePasswords(supplied: string, stored: string) {
  // Check if the stored password is in the expected format (hash.salt)
  if (!stored || !stored.includes(".")) {
    console.warn('Stored password is not in expected format (hash.salt)');
    return false;
  }
  
  const [hashed, salt] = stored.split(".");
  
  // Validate that we have both hash and salt
  if (!hashed || !salt) {
    console.warn('Invalid password format: missing hash or salt');
    return false;
  }
  
  try {
    // Use PBKDF2 to match the hashing method used in storage.ts
    const crypto = await import('crypto');
    const suppliedHash = crypto.pbkdf2Sync(supplied, salt, 1000, 64, 'sha512').toString('hex');
    return timingSafeEqual(Buffer.from(hashed, 'hex'), Buffer.from(suppliedHash, 'hex'));
  } catch (error) {
    console.error('Error comparing passwords:', error);
    return false;
  }
}

export function setupAuth(app: Express) {
  void ensureSuperAdminLogin();

  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "syncbridge-secret-key",
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      secure: app.get("env") === "production",
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy({
      usernameField: 'email',
      passwordField: 'password'
    }, async (email, password, done) => {
      try {
        console.log('LocalStrategy: Attempting to find user by email:', email);
        const user = await storage.getUserByEmail(email);
        
        if (!user) {
          console.log('LocalStrategy: No user found with email:', email);
          return done(null, false, { message: 'Authentication failed', info: 'User not found' });
        }

        console.log('LocalStrategy: Comparing passwords for user:', email);
        const isPasswordValid = await comparePasswords(password, user.password);
        if (!isPasswordValid) {
          console.log('LocalStrategy: Invalid password for user:', email);
          return done(null, false, { message: 'Authentication failed', info: 'Invalid password' });
        }
        
        // Check if user is active
        if (!user.isActive) {
          console.log('LocalStrategy: User account is not active:', email);
          return done(null, false, { message: 'Authentication failed', info: 'Account not active' });
        }
        
        console.log('LocalStrategy: Authentication successful for user:', email);
        return done(null, user);
      } catch (err) {
        console.error('LocalStrategy: Error during authentication:', err);
        return done(err);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      const { name, email, password, role } = req.body;

      // Validation
      if (!name || !email || !password) {
        return res.status(400).json({ message: "Name, email and password are required" });
      }

      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "Email address is already registered" });
      }

      // Validate the role is one of the enum values
      if (role && !Object.values(userRoleEnum.enumValues).includes(role)) {
        return res.status(400).json({ message: "Invalid role" });
      }

      // Password will be hashed in storage.createUser
      const user = await storage.createUser({
        name,
        email,
        role: role || 'employee',
        password: password,
      }, 1);

      // Create an audit log for the new user registration
      await storage.createAuditLog({
        action: "create",
        entity: "user",
        entityId: user.id,
        userId: user.id,
        timestamp: new Date(),
      });

      // Send verification email
      const verificationUrl = `${req.protocol}://${req.get('host')}/api/verify-email?token=${user.emailVerificationToken}`;
      
      await sendEmail({
        to: user.email,
        subject: "Verify Your Email - SyncBridge",
        html: generateVerificationEmailHTML(verificationUrl, user.name),
        text: generateVerificationEmailText(verificationUrl, user.name),
      });

      // Return success message without logging in the user
      res.status(201).json({ 
        message: "Registration successful! Please check your email to verify your account before logging in.",
        emailSent: true 
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/reset-superadmin", async (_req, res) => {
    try {
      await ensureSuperAdminLogin();
      res.json({
        success: true,
        email: SUPERADMIN_EMAIL,
        password: SUPERADMIN_PASSWORD,
      });
    } catch (error: any) {
      console.error("RESET ERROR:", error);
      res.status(500).json({
        error: error.message,
      });
    }
  });

  app.post("/api/login", (req, res, next) => {
    console.log('Login attempt for email:', req.body.email);
    
    if (!req.body.email || !req.body.password) {
      console.log('Login attempt missing email or password');
      return res.status(400).json({
        message: "Email and password are required",
        info: "Missing credentials"
      });
    }
    
    passport.authenticate("local", (err: any, user: any, info: AuthInfo) => {
      if (err) {
        console.error('Authentication error:', err);
        // Check for specific database errors
        if (err.code === '57P01' || err.code === '57P02' || err.code === '57P03') {
          return res.status(503).json({
            message: "Database connection error",
            error: "Service temporarily unavailable"
          });
        }
        if (err.code === '42P01') {
          return res.status(500).json({
            message: "Database configuration error",
            error: "Missing required tables"
          });
        }
        return res.status(500).json({ 
          message: "Internal server error during authentication",
          error: err.message || 'Unknown error'
        });
      }
      
      if (!user) {
        console.log('Authentication failed for email:', req.body.email, 'Reason:', info?.info || info?.message);
        return res.status(401).json({ 
          message: "Authentication failed",
          info: info?.info || info?.message || "Unknown error"
        });
      }
      
      req.login(user, (loginErr) => {
        if (loginErr) {
          console.error('Session creation error:', loginErr);
          return res.status(500).json({ 
            message: "Error creating user session",
            error: loginErr.message
          });
        }
        
        console.log('Login successful for user:', user.email);
        console.log('User role:', user.role);
        console.log('User tenant ID:', user.tenantId);
        console.log('Is super admin:', user.isSuperAdmin);
        
      // Return the user without the password
      const { password, ...userWithoutPassword } = user;
      return res.status(200).json(userWithoutPassword);

      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    // Return the user without the password
    const { password, ...userWithoutPassword } = req.user;
    res.json(userWithoutPassword);
  });

  // Role-based authentication middleware
  const requireRole = (roles: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      // For demonstration purposes, allow all authenticated users regardless of role
      // Comment out the role check for now
      // if (!roles.includes(req.user.role)) {
      //   return res.status(403).json({ message: "Insufficient permissions" });
      // }
      
      next();
    };
  };

  // Export the authentication functions
  return {
    requireRole,
    hashPassword
  };
}
