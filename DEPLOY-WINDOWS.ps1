# PokéFlip Studio — deploy to the pre-created Vercel project.
# Run from an extracted release folder in PowerShell on your own Windows PC.
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
if (-not (Get-Command npx -ErrorAction SilentlyContinue)) {
  Write-Error 'Node.js is required. Install the current Node LTS from nodejs.org and rerun.'
}
if (-not (Test-Path '.vercel/project.json')) { Write-Error 'Missing Vercel project link; refusing to deploy to a guessed project.' }
Write-Host 'Target: pokeflip-studio (existing Vercel project)'
Write-Host 'This publishes the folder to the internet. Review contents and confirm the target project.'
$proceed = Read-Host 'Type DEPLOY to continue'
if ($proceed -cne 'DEPLOY') { Write-Host 'Deployment cancelled.'; exit 0 }
Write-Host 'You may be prompted to authenticate with Vercel.'
& npx --yes vercel@latest deploy --prod
if ($LASTEXITCODE -ne 0) { Write-Error 'Vercel deployment failed. Check authentication, project access, and build logs.' }
Write-Host 'Deployment requested. Verify the live URL and follow the acceptance checklist in RELEASE-STATUS.md.'