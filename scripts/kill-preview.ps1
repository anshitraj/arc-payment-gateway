# Kill all node processes running on preview ports
Write-Host "Killing all node processes on preview ports..."
Get-Process | Where-Object {$_.ProcessName -eq "node"} | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
Write-Host "Done. Now run: npm run preview"
Write-Host "Then access: http://localhost:4173"

