# PostgreSQL Setup for SyncBridge

This guide shows how to set up PostgreSQL for SyncBridge without modifying system PATH variables.

## Prerequisites

1. **Install PostgreSQL 15** from: https://www.postgresql.org/download/windows/
   - Install to default location: `C:\Program Files\postgresql\17\`
   - Set password as: `Welcome123`
   - Install all components

## Setup Options

### Option 1: Batch File (Command Prompt)
```cmd
# Run the database setup
.\setup-database-complete.bat

# Launch SyncBridge with database check
.\launch-syncbridge-with-db.bat
```

### Option 2: PowerShell Script
```powershell
# Run the database setup
.\setup-database.ps1

# Or import helper functions
. .\psql-helper.ps1
Test-PostgreSQL
Test-DatabaseConnection
New-SyncBridgeDatabase
```

### Option 3: Manual Commands

#### In Command Prompt:
```cmd
# Set password and run psql
set PGPASSWORD=Welcome123
"C:\Program Files\postgresql\17\bin\psql.exe" -U postgres -h localhost

# Create database
CREATE DATABASE syncbridge;
\q
```

#### In PowerShell:
```powershell
# Set password and run psql
$env:PGPASSWORD = "Welcome123"
& "C:\Program Files\postgresql\17\bin\psql.exe" -U postgres -h localhost

# Create database
CREATE DATABASE syncbridge;
\q
```

#### In Cursor Terminal:
```bash
# Set password and run psql
export PGPASSWORD=Welcome123
"C:\Program Files\postgresql\17\bin\psql.exe" -U postgres -h localhost

# Create database
CREATE DATABASE syncbridge;
\q
```

## Helper Functions (PowerShell)

After importing `psql-helper.ps1`:

```powershell
# Check if PostgreSQL is available
Test-PostgreSQL

# Test database connection
Test-DatabaseConnection

# Create database
New-SyncBridgeDatabase

# Run custom SQL
Invoke-PSQL -Command "SELECT version();"
Invoke-PSQL -Command "SELECT * FROM users;" -Database syncbridge
```

## Troubleshooting

### PostgreSQL Not Found
- Ensure PostgreSQL is installed to: `C:\Program Files\postgresql\17\`
- Check if the path exists: `Test-Path "C:\Program Files\postgresql\17\bin\psql.exe"`

### Connection Failed
- Check if PostgreSQL service is running: `Get-Service postgresql-x64-15`
- Start service: `Start-Service postgresql-x64-15`
- Verify password is: `Welcome123`

### Database Not Found
- Create database manually:
  ```sql
  CREATE DATABASE syncbridge;
  ```

## Launch SyncBridge

After database setup:
```cmd
# Direct launch
.\dist-electron-fi\win-unpacked\SyncBridge.exe

# With database check
.\launch-syncbridge-with-db.bat
```

**Note**: The application now automatically copies server files to a temporary directory to ensure proper execution.

## Notes

- ✅ No system PATH modifications required
- ✅ Works in Command Prompt, PowerShell, and Cursor terminal
- ✅ Uses full path to `psql.exe`
- ✅ Sets password only for current session
- ✅ No admin permissions needed 