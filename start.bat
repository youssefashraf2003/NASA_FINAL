@echo off
echo Starting NASA Bioscience Explorer Server...
cd /d "%~dp0"

echo Launching the application in your browser...
start http://localhost:3000

echo Starting the server...
node server.js

pause