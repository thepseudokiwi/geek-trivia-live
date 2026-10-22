param([string]$Email)
$ErrorActionPreference = 'Stop'
Push-Location $PSScriptRoot
try {
    if (-not $Email) { $Email = Read-Host 'Email address for your Nerd Wars host or administrator account' }
    $nodeCommand = (Get-Command node.exe -ErrorAction SilentlyContinue).Source
    if (-not $nodeCommand) {
        $bundledNode = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
        if (Test-Path -LiteralPath $bundledNode) { $nodeCommand = $bundledNode }
    }
    if (-not $nodeCommand) { throw 'Node.js was not found. Start this from the Nerd Wars server computer.' }
    & $nodeCommand --import tsx scripts/resetAdminPassword.ts $Email
    if ($LASTEXITCODE -ne 0) { throw 'The recovery link could not be created.' }
    $reset = Get-Content -Raw -LiteralPath '.local/password-reset.json' | ConvertFrom-Json
    Write-Host 'Opening your private password reset page. Nerd Wars must be running.'
    Start-Process $reset.link
} finally { Pop-Location }
