$ErrorActionPreference = 'Stop'

$projectPath = 'C:\Users\theps\OneDrive\Projects\Nerd Wars'
$platformUrl = 'http://127.0.0.1:8787'

function Test-NerdWarsPort {
    param([int]$Port)
    $client = [System.Net.Sockets.TcpClient]::new()
    try {
        $connection = $client.ConnectAsync('127.0.0.1', $Port)
        return $connection.Wait(250) -and $client.Connected
    }
    catch {
        return $false
    }
    finally {
        $client.Dispose()
    }
}

if (-not (Test-NerdWarsPort -Port 8787)) {
    $nodeCommand = (Get-Command node.exe -ErrorAction SilentlyContinue).Source
    $bundledNode = 'C:\Users\theps\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
    if (-not $nodeCommand -and (Test-Path -LiteralPath $bundledNode)) {
        $nodeCommand = $bundledNode
    }
    if (-not $nodeCommand) { throw 'Node.js was not found on this computer.' }

    Start-Process -FilePath $nodeCommand -ArgumentList '--import', 'tsx', 'server/index.ts' -WorkingDirectory $projectPath -WindowStyle Hidden

    $ready = $false
    for ($attempt = 0; $attempt -lt 40; $attempt++) {
        Start-Sleep -Milliseconds 500
        if (Test-NerdWarsPort -Port 8787) {
            $ready = $true
            break
        }
    }

    if (-not $ready) {
        throw 'Nerd Wars did not finish starting.'
    }
}

Start-Process $platformUrl
