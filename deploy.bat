@echo off
echo ================================================
echo   Watch With Friends - Vercel Deployment
echo   Made with Love for Aahana and DEEP 
echo ================================================
echo.

echo Step 1: Installing Vercel CLI...
call npm install -g vercel
echo.

echo Step 2: Building Frontend...
cd frontend
call npm run build
cd ..
echo.

echo Step 3: Building Backend...
cd backend
call npm run build
cd ..
echo.

echo ================================================
echo   Ready to Deploy!
echo ================================================
echo.
echo Now run these commands:
echo.
echo   1. vercel login
echo   2. vercel
echo   3. vercel --prod
echo.
echo ================================================
pause
