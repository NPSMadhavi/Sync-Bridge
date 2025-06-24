# SyncBridge - Enterprise Asset & Document Management Platform

## Overview
SyncBridge is a comprehensive full-stack enterprise asset and document management platform built with modern web technologies. The application provides multi-tenant functionality for organizations to manage their assets, employees, documents, licenses, and vendor relationships efficiently.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and optimized builds
- **UI Library**: shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with custom theme configuration
- **State Management**: TanStack Query (React Query) for server state
- **Form Handling**: React Hook Form with Zod validation
- **Routing**: Wouter for lightweight client-side routing
- **Responsive Design**: Mobile-first approach with responsive components

### Backend Architecture
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js for RESTful API endpoints
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Passport.js with local strategy and session-based auth
- **File Handling**: Custom base64 file upload system
- **Session Storage**: PostgreSQL session store with fallback to memory store

### Database Design
- **Multi-tenant Architecture**: Tenant-based data isolation
- **Schema Management**: Drizzle ORM with TypeScript-first approach
- **Database Migrations**: Drizzle Kit for schema changes
- **Connection**: Neon serverless PostgreSQL driver

## Key Components

### Multi-tenancy
- Tenant-based data isolation at the database level
- Subdomain and header-based tenant resolution
- Per-tenant user limits and feature restrictions
- Subscription plan management (free, starter, business, enterprise)

### Authentication & Authorization
- Role-based access control (super_admin, admin, hr, it_manager, employee)
- Session-based authentication with secure cookies
- Password hashing using Node.js crypto module
- Protected routes with role-based middleware

### Asset Management
- Complete asset lifecycle tracking
- Asset assignment to employees
- Maintenance record management
- Asset status tracking (available, assigned, maintenance, retired)
- Support for various asset types (laptop, monitor, smartphone, etc.)

### Employee Management
- Employee profile management with department and designation
- Document management (passport, visa, contracts, certifications)
- Dependent tracking
- Integration with user accounts

### Document Management
- File upload and storage system
- Document expiry tracking and notifications
- Support for multiple document types
- Base64 file handling with filesystem storage

### License Management
- Software and hardware license tracking
- License expiry monitoring
- Cost and vendor management
- License type categorization

### Vendor Management
- Vendor contact information and relationship tracking
- Integration with asset and license management
- Vendor performance tracking

## Data Flow

### Authentication Flow
1. User submits credentials via login form
2. Backend validates credentials against database
3. Session created and stored in PostgreSQL
4. Frontend receives user data and updates auth context
5. Protected routes check authentication status

### Asset Assignment Flow
1. Admin/IT Manager selects available asset
2. Employee selection from dropdown
3. Assignment record created with timestamp
4. Asset status updated to "assigned"
5. Audit log entry created
6. Notification sent to relevant parties

### Document Upload Flow
1. Frontend converts file to base64
2. Base64 data sent to backend API
3. Backend decodes and saves file to filesystem
4. File path stored in database
5. Document metadata recorded with expiry tracking

## External Dependencies

### Production Dependencies
- **@neondatabase/serverless**: PostgreSQL serverless driver
- **drizzle-orm**: TypeScript ORM for database operations
- **@tanstack/react-query**: Server state management
- **@radix-ui/***: Headless UI components
- **express**: Web application framework
- **passport**: Authentication middleware
- **@sendgrid/mail**: Email service integration
- **react-hook-form**: Form state management
- **zod**: Runtime type validation

### Development Dependencies
- **tsx**: TypeScript execution for development
- **esbuild**: Fast JavaScript bundler for production
- **tailwindcss**: Utility-first CSS framework
- **typescript**: Type checking and compilation

## Deployment Strategy

### Development Environment
- **Command**: `npm run dev`
- **Hot Reload**: Vite development server with HMR
- **Port**: 5000 (configurable)
- **Database**: Requires PostgreSQL connection

### Production Build
- **Frontend**: Vite builds optimized static assets
- **Backend**: esbuild bundles server code
- **Output**: `dist/` directory with client and server bundles
- **Start Command**: `npm run start`

### Deployment Configuration
- **Platform**: Configured for Replit autoscale deployment
- **Build Process**: Two-stage build (frontend + backend)
- **Environment Variables**: DATABASE_URL required
- **Session Secret**: Configurable via environment

## Changelog
- June 24, 2025. Initial setup
- June 24, 2025. Added comprehensive invoicing system with customer management, invoice creation with line items, tax/discount calculations, and status tracking. Fixed authentication error messages to show professional "Incorrect credentials" instead of raw API responses.
- June 24, 2025. Implemented role-based access control with user management system. Removed registration from login screen, added hardcoded admin credentials (supadmin@myrsv.com), and created module-based permissions system where administrators can create users and assign access rights to specific modules based on roles (Administrator, IT Manager, HR Manager, Accountant, Employee).
- June 24, 2025. Enhanced user management with role-based default module selection, password visibility toggle, collapsible sidebar navigation, and proper routing for user management page. Improved user experience with intuitive navigation and better form controls.
- June 24, 2025. Switched from memory storage to PostgreSQL database storage for data persistence. Updated invoice form with Singapore ACRA compliance including 9% GST default rate and proper accounting terminology.
- June 24, 2025. Completed database migration from placeholder to real PostgreSQL connection. Enhanced audit logging system with automatic notification creation for all user actions. All data now persists in database with comprehensive audit trail and notification updates.
- June 24, 2025. Fixed PostgreSQL persistence configuration for production deployment. Main application data uses PostgreSQL with proper connection handling. Session store configured with PostgreSQL primary and memory fallback for resilience. Application ready for deployment with full database persistence.

## User Preferences
Preferred communication style: Simple, everyday language.
Accounting standards: ACRA Singapore compliance with 9% GST rate as default.