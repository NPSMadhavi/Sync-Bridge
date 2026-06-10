@echo off
echo Testing PostgreSQL connection to syncbridge_backup...
echo.

set PGPASSWORD=root
"C:\Program Files\postgresql\17\bin\psql.exe" -U postgres -h localhost -d syncbridge_backup -c "SELECT current_database(), current_user, version();"

if %errorlevel% neq 0 (
    echo.
    echo Connection failed. Trying to list databases...
    "C:\Program Files\postgresql\17\bin\psql.exe" -U postgres -h localhost -c "\l"
)

pause
