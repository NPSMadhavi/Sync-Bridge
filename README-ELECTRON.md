# SyncBridge Desktop App

This guide explains how to run SyncBridge as a desktop application using Electron.

## Prerequisites

- Node.js (v16 or higher)
- PostgreSQL database (local or hosted)
- npm or yarn package manager

## Installation

1. Install dependencies:
```bash
npm install
```

2. Set up your database and environment variables:
   - Copy `server/.env.example` to `server/.env`
   - Update the database connection string and other settings
   - Ensure PostgreSQL is running and accessible

## Development

### Running the Desktop App in Development Mode

```bash
npm run electron:dev
```

This command will:
1. Start the backend server on port 5000
2. Start the Vite dev server on port 5173
3. Launch the Electron app

### Running Individual Components

- **Backend only**: `npm run dev`
- **Frontend only**: `npx vite`
- **Electron only**: `npm run electron` (requires both servers to be running)

## Building for Production

### Create Desktop Installer

```bash
npm run electron:dist
```

This will:
1. Build the frontend and backend
2. Package everything into a desktop installer
3. Output files will be in the `dist-electron` folder

### Build Options

- **Windows**: Creates `.exe` installer
- **macOS**: Creates `.dmg` installer  
- **Linux**: Creates `.AppImage` file

## Project Structure

```
SyncBridge/
├── main.js                 # Electron main process
├── preload.js             # Electron preload script
├── client/                # React frontend
├── server/                # Node.js backend
├── shared/                # Shared database schema
├── scripts/
│   └── start-electron-dev.js  # Development startup script
└── dist-electron/         # Built desktop app (after build)
```

## Configuration

### API Configuration

The app automatically detects whether it's running in Electron or web browser:

- **Desktop (Electron)**: API calls go to `http://localhost:5000`
- **Web Browser**: API calls use relative URLs (same origin)

### Environment Variables

Key environment variables in `server/.env`:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/syncbridge"
SESSION_SECRET="your-secure-session-secret"
NODE_ENV="development"
```

## Troubleshooting

### Common Issues

1. **Port conflicts**: Ensure ports 5000 and 5173 are available
2. **Database connection**: Verify PostgreSQL is running and accessible
3. **Build errors**: Check that all dependencies are installed

### Development Tips

- Use `Ctrl+Shift+I` (or `Cmd+Option+I` on Mac) to open DevTools in the desktop app
- The backend server logs will appear in the terminal where you ran `npm run electron:dev`
- Frontend changes will hot-reload automatically

## Deployment

### For Distribution

1. Build the app: `npm run electron:dist`
2. Find the installer in `dist-electron/` folder
3. Distribute the installer to users

### Database Setup for Production

- Use a hosted PostgreSQL service (e.g., Neon, Supabase, AWS RDS)
- Update the `DATABASE_URL` in your production environment
- Ensure proper security settings and backups

## Security Notes

- The desktop app runs the backend server locally
- Database credentials are stored in the `server/.env` file
- Consider using environment-specific configuration for production
- Implement proper authentication and authorization

## Support

For issues or questions:
1. Check the console logs in DevTools
2. Review the backend server logs
3. Ensure all prerequisites are met
4. Verify database connectivity 