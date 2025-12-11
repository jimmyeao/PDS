@echo off
echo ========================================
echo Testing Kiosk Digital Signage API
echo ========================================
echo.

echo 1. Health Check
curl -X GET http://localhost:3000/api/health
echo.
echo.

echo 2. Login as Admin
curl -X POST http://localhost:3000/api/auth/login ^
  -H "Content-Type: application/json" ^
  -d "{\"username\":\"admin\",\"password\":\"admin123\"}"
echo.
echo.

echo 3. Copy the accessToken from above and set it here:
set /p TOKEN="Enter your access token: "
echo.

echo 4. Get Current User Profile
curl -X GET http://localhost:3000/api/auth/me ^
  -H "Authorization: Bearer %TOKEN%"
echo.
echo.

echo 5. Create a Device
curl -X POST http://localhost:3000/api/devices ^
  -H "Content-Type: application/json" ^
  -H "Authorization: Bearer %TOKEN%" ^
  -d "{\"deviceId\":\"rpi-001\",\"name\":\"Lobby Display\",\"description\":\"Main entrance display\",\"location\":\"Building A - Lobby\"}"
echo.
echo.

echo 6. List All Devices
curl -X GET http://localhost:3000/api/devices ^
  -H "Authorization: Bearer %TOKEN%"
echo.
echo.

echo 7. Create Content
curl -X POST http://localhost:3000/api/content ^
  -H "Content-Type: application/json" ^
  -H "Authorization: Bearer %TOKEN%" ^
  -d "{\"name\":\"Company Website\",\"url\":\"https://www.google.com\",\"description\":\"Main company website\",\"requiresInteraction\":false}"
echo.
echo.

echo 8. List All Content
curl -X GET http://localhost:3000/api/content ^
  -H "Authorization: Bearer %TOKEN%"
echo.
echo.

echo ========================================
echo Testing Complete!
echo ========================================
pause
