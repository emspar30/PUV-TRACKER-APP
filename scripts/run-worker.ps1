# DR6: runs the SMS worker on the team PC (Q3) and starts it again if it stops. No dependencies.
#   powershell -ExecutionPolicy Bypass -File scripts\run-worker.ps1
# Build the bundle first: npm run worker:build. The settings are read from services\sms-worker\.env
# (see services\sms-worker\README.md). Each day's output goes to services\sms-worker\logs\worker-<date>.log.
# Start it at Windows sign-in with Task Scheduler (README, "Team PC"). Ctrl+C stops the loop.

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$bundle = Join-Path $root 'services\sms-worker\dist\worker.cjs'
$logs = Join-Path $root 'services\sms-worker\logs'
$restartDelayS = 10

if (-not (Test-Path $bundle)) {
  Write-Host "No bundle at $bundle. Run: npm run worker:build"
  exit 1
}
New-Item -ItemType Directory -Force $logs | Out-Null

while ($true) {
  $log = Join-Path $logs ("worker-{0}.log" -f (Get-Date -Format 'yyyy-MM-dd'))
  Add-Content -Path $log -Value ("{0} run-worker: starting" -f (Get-Date -Format o)) -Encoding utf8
  # The worker's own lines are JSON with numbers already masked
  & node $bundle 2>&1 | ForEach-Object { $_.ToString() } | Tee-Object -FilePath $log -Append
  Add-Content -Path $log -Value ("{0} run-worker: stopped with exit code {1}; restarting in {2} s" -f (Get-Date -Format o), $LASTEXITCODE, $restartDelayS) -Encoding utf8
  Start-Sleep -Seconds $restartDelayS
}
