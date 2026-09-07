$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)
$portableNode = Join-Path $PWD '.tools\node-v24.20.0-win-x64'
if (Test-Path -LiteralPath (Join-Path $portableNode 'node.exe')) { $env:PATH = "$portableNode;$env:PATH" }
node scripts/check-production.mjs
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
$env:NODE_ENV = 'production'
npm.cmd run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
npm.cmd start
exit $LASTEXITCODE
