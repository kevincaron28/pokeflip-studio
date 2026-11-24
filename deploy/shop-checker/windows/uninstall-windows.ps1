# Remove the Cardstead shop checker task from this PC (runbook: docs/SHOP-CHECKER-WINDOWS.md).
#   powershell -ExecutionPolicy Bypass -File uninstall-windows.ps1              # remove the task, keep files and key
#   powershell -ExecutionPolicy Bypass -File uninstall-windows.ps1 -RemoveFiles # also delete code, logs and checker.env
# Afterwards, in Supabase: delete from public.checker_keys where label = 'owner-pc';
# Leave the Supabase cron job shop-checker-tick paused: Shopify refuses Supabase's address (429), so it is no fallback.
param([switch]$RemoveFiles)
$ErrorActionPreference = 'Stop'
$TaskName = 'Cardstead shop checker'
if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
  Write-Host "removed task '$TaskName'"
} else { Write-Host 'no task to remove' }
if ($RemoveFiles) {
  $dir = Join-Path $env:LOCALAPPDATA 'Cardstead\checker'
  if (Test-Path $dir) { Remove-Item -Recurse -Force -LiteralPath $dir; Write-Host "deleted $dir" }
}
