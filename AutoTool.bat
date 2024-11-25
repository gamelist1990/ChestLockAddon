@echo off
chcp 65001 >nul
echo Copying node_modules folder to devFolder\src...
xcopy /E /I /H /Y node_modules devFolder\src\node_modules

if %errorlevel% neq 0 (
  echo xcopy に失敗しました
  exit /b %errorlevel%
)

echo node index.js を実行中...
node tool/index.js

if %errorlevel% neq 0 (
  echo node index.js に失敗しました
  exit /b %errorlevel%
)

echo node index2.js を実行中...
node tool/index2.js

if %errorlevel% neq 0 (
  echo node index2.js に失敗しました
  exit /b %errorlevel%
)

echo tsc を実行中...
tsc

if %errorlevel% neq 0 (
  echo tsc に失敗しました
  exit /b %errorlevel%
)

echo 全ての処理が完了しました
pause
