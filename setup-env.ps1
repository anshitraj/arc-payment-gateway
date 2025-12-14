# Setup Environment File Script
# Run this script to create a .env file from template

Write-Host "Setting up .env file..." -ForegroundColor Cyan

if (Test-Path .env) {
    Write-Host ".env file already exists!" -ForegroundColor Yellow
    $overwrite = Read-Host "Do you want to overwrite it? (y/N)"
    if ($overwrite -ne "y" -and $overwrite -ne "Y") {
        Write-Host "Skipping .env creation." -ForegroundColor Yellow
        exit
    }
}

Write-Host "`nCreating .env file..." -ForegroundColor Green
Write-Host "You'll need to add your Neon database connection string." -ForegroundColor Yellow
Write-Host "Get it from: https://neon.tech`n" -ForegroundColor Cyan

$envContent = @"
# Database Configuration
# Get your connection string from Neon: https://neon.tech
DATABASE_URL=postgresql://user:password@host:port/database

# Server Configuration
PORT=3000
SESSION_SECRET=change-this-to-a-random-secret-string

# ARC Testnet Configuration
ARC_CHAIN_ID=1243
ARC_RPC_URL=https://rpc-testnet.arc.network
ARC_EXPLORER_URL=https://testnet-explorer.arc.network/tx

# Demo Mode (set to false for production)
DEMO_MODE=true
"@

$envContent | Out-File -FilePath .env -Encoding utf8

Write-Host "✅ Created .env file!" -ForegroundColor Green
Write-Host "`n⚠️  IMPORTANT: Edit .env and add your DATABASE_URL from Neon" -ForegroundColor Yellow
Write-Host "   Then run: npm run db:push`n" -ForegroundColor Cyan

