# Install the Cardstead shop checker on the owner's Windows PC (runbook: docs/SHOP-CHECKER-WINDOWS.md).
# Run in a normal PowerShell window (no admin needed):
#   powershell -ExecutionPolicy Bypass -File install-windows.ps1
# Installs under %LOCALAPPDATA%\Cardstead\checker (no spaces, nothing in the repository folders).
# Safe to run again. It never writes or shows the checker key and never overwrites checker.env.
# The scheduled task is created switched OFF: paste the key, run one pass by hand, then turn it on (runbook).
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
  # Same pacing as the server checker: 3 shops at a time, back-off after 403/429 (built into the checker).
  Copy-Item (Join-Path $App 'deploy\shop-checker\checker.env.example') $EnvFile
  Write-Host "created $EnvFile"
}
else {
  # The first version of this installer wrote a gentler home pacing (2 at a time, 500 ms apart). Move exactly that
  # old default to the server pacing; anything else was chosen by hand and is kept. Other lines (the key) are untouched.
  $txt = [IO.File]::ReadAllText($EnvFile)
  if ($txt -match '(?m)^CHECKER_CONCURRENCY=2\s*$' -and $txt -match '(?m)^CHECKER_GAP_MS=500\s*$') {
    $txt = $txt -replace '(?m)^CHECKER_CONCURRENCY=2(\s*)$', 'CHECKER_CONCURRENCY=3$1' -replace '(?m)^CHECKER_GAP_MS=500(\s*)$', 'CHECKER_GAP_MS=0$1'
    [IO.File]::WriteAllText($EnvFile, $txt, (New-Object Text.UTF8Encoding $false))
    Write-Host 'pacing updated to the server default: 3 shops at a time'
  }
  Remove-Variable txt
}
$me = "$env:USERDOMAIN\$env:USERNAME"
& icacls $EnvFile /inheritance:r /grant:r "${me}:(R,W)" | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'could not restrict checker.env to your account' }
$hasKey = Select-String -Path $EnvFile -Pattern '^CHECKER_KEY=[0-9a-f]{64}\s*$' -Quiet

Write-Host '== scheduled task (created switched off)'
# conhost --headless runs Node without any window. Every 2 minutes, only while you are signed in, normal rights;
# never two passes at once; a pass is stopped after 2 minutes; low priority; never wakes the PC.
$action = New-ScheduledTaskAction -Execute "$env:WINDIR\System32\conhost.exe" -Argument "--headless `"$node`" `"$runner`"" -WorkingDirectory $Home_
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 2)
$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 2) `
  -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -Priority 7
$principal = New-ScheduledTaskPrincipal -UserId $me -LogonType Interactive -RunLevel Limited
$task = New-ScheduledTask -Action $action -Trigger $trigger -Settings $settings -Principal $principal `
  -Description 'Cardstead: checks public Shopify stock of Canadian card shops every 2 minutes (docs/SHOP-CHECKER-WINDOWS.md).'
Register-ScheduledTask -TaskName $TaskName -InputObject $task -Force | Out-Null
Disable-ScheduledTask -TaskName $TaskName | Out-Null

Write-Host ''
Write-Host "Installed. CHECKER_KEY: $(if ($hasKey) { 'present' } else { 'missing' }). The task is OFF."
Write-Host 'Next (docs/SHOP-CHECKER-WINDOWS.md):'
Write-Host "  1. Supabase SQL Editor:  select public.checker_new_key('owner-pc');   then  notepad `"$EnvFile`""
Write-Host '     and paste the key right after CHECKER_KEY= (the only secret line). Save and close.'
Write-Host "  2. One pass by hand:  & `"$node`" `"$runner`"; & `"$node`" `"$runner`" --status"
Write-Host "  3. Turn it on:  Enable-ScheduledTask -TaskName '$TaskName'"
Write-Host "  Status any time:  & `"$node`" `"$runner`" --status"
