# Install the Cardstead shop checker on the owner's Windows PC (runbook: docs/SHOP-CHECKER-WINDOWS.md).
# Run in a normal PowerShell window (no admin needed):
#   powershell -ExecutionPolicy Bypass -File install-windows.ps1
# Safe to run again. It never writes or shows the checker key and never overwrites checker.env.
# The scheduled task is created switched OFF: run one pass by hand first, then turn it on (runbook, steps 4-5).
# -RunWhileSignedOut: also run when nobody is signed in (needs an administrator PowerShell; no password is stored).
param([switch]$RunWhileSignedOut)
$ErrorActionPreference = 'Stop'
$TaskName = 'Cardstead shop checker'
$Home_ = Join-Path $env:LOCALAPPDATA 'Cardstead\checker'
$App = Join-Path $Home_ 'app'
$EnvFile = Join-Path $Home_ 'checker.env'
$Repo = 'https://github.com/kevincaron28/pokeflip-studio.git'

Write-Host '== tools'
$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) { throw 'Node.js is not installed (https://nodejs.org, version 22 or later).' }
$major = [int]((& $node -v).TrimStart('v').Split('.')[0])
if ($major -lt 22) { throw "Node.js $major is too old; install version 22 or later." }
$git = (Get-Command git -ErrorAction SilentlyContinue).Source
if (-not $git) { throw 'Git is not installed (https://git-scm.com).' }
Write-Host "node $(& $node -v) at $node"

Write-Host '== code (only the checker files)'
New-Item -ItemType Directory -Force -Path $Home_ | Out-Null
if (-not (Test-Path (Join-Path $App '.git'))) {
  & $git clone -q --depth 1 --filter=blob:none --sparse --branch main $Repo $App
  if ($LASTEXITCODE -ne 0) { throw 'git clone failed' }
  & $git -C $App sparse-checkout set supabase/functions/_shared deploy/shop-checker
  if ($LASTEXITCODE -ne 0) { throw 'git sparse-checkout failed' }
}
$runner = Join-Path $App 'deploy\shop-checker\windows\run-windows.mjs'
if (-not (Test-Path $runner)) { throw "missing $runner" }

Write-Host '== settings (readable by your Windows account only)'
if (-not (Test-Path $EnvFile)) {
  $example = Get-Content -Raw (Join-Path $App 'deploy\shop-checker\checker.env.example')
  # A home connection: a little gentler than the server defaults.
  $example = $example -replace '(?m)^CHECKER_CONCURRENCY=.*$', 'CHECKER_CONCURRENCY=2' -replace '(?m)^CHECKER_GAP_MS=.*$', 'CHECKER_GAP_MS=500'
  [IO.File]::WriteAllText($EnvFile, $example, (New-Object Text.UTF8Encoding $false))
  Write-Host "created $EnvFile"
}
$me = "$env:USERDOMAIN\$env:USERNAME"
& icacls $EnvFile /inheritance:r /grant:r "${me}:(R,W)" | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'could not restrict checker.env to your account' }
$hasKey = Select-String -Path $EnvFile -Pattern '^CHECKER_KEY=[0-9a-f]{64}\s*$' -Quiet

Write-Host '== scheduled task (created switched off)'
# conhost --headless runs Node without any window. Every 2 minutes; never two passes at once; a pass is stopped after 2 minutes.
$action = New-ScheduledTaskAction -Execute "$env:WINDIR\System32\conhost.exe" -Argument "--headless `"$node`" `"$runner`"" -WorkingDirectory $Home_
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 2)
$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 2) `
  -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -Priority 7
if ($RunWhileSignedOut) {
  $principal = New-ScheduledTaskPrincipal -UserId $me -LogonType S4U -RunLevel Limited
} else {
  $principal = New-ScheduledTaskPrincipal -UserId $me -LogonType Interactive -RunLevel Limited
}
$task = New-ScheduledTask -Action $action -Trigger $trigger -Settings $settings -Principal $principal `
  -Description 'Cardstead: checks public Shopify stock of Canadian card shops every 2 minutes (docs/SHOP-CHECKER-WINDOWS.md).'
Register-ScheduledTask -TaskName $TaskName -InputObject $task -Force | Out-Null
Disable-ScheduledTask -TaskName $TaskName | Out-Null

Write-Host ''
Write-Host "Installed. CHECKER_KEY: $(if ($hasKey) { 'present' } else { 'missing' }). The task is OFF."
Write-Host 'Next (docs/SHOP-CHECKER-WINDOWS.md):'
Write-Host "  3. Supabase SQL Editor:  select public.checker_new_key('owner-pc');   then  notepad `"$EnvFile`""
Write-Host '     and paste the key right after CHECKER_KEY= (the only secret line). Save and close.'
Write-Host '  4. Pause the Supabase cron job shop-checker-tick (do not delete it). One pass by hand:'
Write-Host "       & `"$node`" `"$runner`"; Get-Content `"$Home_\logs\checker.log`" -Tail 20"
Write-Host "  5. Turn it on:  Enable-ScheduledTask -TaskName '$TaskName'"
