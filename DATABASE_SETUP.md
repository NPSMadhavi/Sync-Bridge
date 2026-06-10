# Database Setup Guide for SyncBridge

## Quick Setup

### Option 1: Install PostgreSQL (Recommended)

1. **Download PostgreSQL:**
   - Go to: https://www.postgresql.org/download/windows/
   - Download the latest version for Windows

2. **Install PostgreSQL:**
   - Run the installer
   - Set password for user `postgres` to: `Welcome123`
   - Keep default port: `5432`
   - Complete the installation

3. **Create Database:**
   - Open pgAdmin (comes with PostgreSQL)
   - Connect to your server
   - Right-click on "Databases"
   - Select "Create" > "Database"
   - Name it: `syncbridge`
   - Click "Save"

### Option 2: Use Docker (Advanced)

```bash
docker run --name syncbridge-db -e POSTGRES_PASSWORD=root-e POSTGRES_DB=syncbridge -p 5432:5432 -d postgres
```

### Option 3: Use Existing Database

If you already have PostgreSQL running, update the connection in `launch-syncbridge.bat`:

```batch
set DATABASE_URL=postgresql://YOUR_USERNAME:YOUR_PASSWORD@localhost:5432/YOUR_DATABASE_NAME
```

## Test Database Connection

After setup, test if the database is working:

1. Open Command Prompt
2. Navigate to your SyncBridge folder
3. Run: `.\start-backend.ps1`

If you see "Server running on port 5000", the database is working!

## Troubleshooting

### Common Issues:

1. **"DATABASE_URL not provided"**
   - Make sure PostgreSQL is installed and running
   - Check if the database `syncbridge` exists
   - Verify username/password are correct

2. **"Connection refused"**
   - PostgreSQL service is not running
   - Start PostgreSQL service in Windows Services

3. **"Authentication failed"**
   - Wrong password for user `postgres`
   - Reset password or update the DATABASE_URL

### Check PostgreSQL Status:

1. Open Windows Services (services.msc)
2. Look for "postgresql-x64-XX" service
3. Make sure it's "Running"
4. If not, right-click and select "Start"

## Default Configuration

- **Host:** localhost
- **Port:** 5432
- **Database:** syncbridge
- **Username:** postgres
- **Password:** Welcome123

Once the database is set up, the `launch-syncbridge.bat` file will work perfectly!