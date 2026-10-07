$ErrorActionPreference = 'Stop'
$Port = 8765
$Root = [System.IO.Path]::GetFullPath((Split-Path -Parent $MyInvocation.MyCommand.Path))
$Address = [System.Net.IPAddress]::Loopback
$Listener = New-Object System.Net.Sockets.TcpListener -ArgumentList $Address, $Port

function Get-ContentType([string]$Path) {
    switch ([System.IO.Path]::GetExtension($Path).ToLowerInvariant()) {
        '.html' { return 'text/html; charset=utf-8' }
        '.js'   { return 'application/javascript; charset=utf-8' }
        '.css'  { return 'text/css; charset=utf-8' }
        '.json' { return 'application/json; charset=utf-8' }
        '.webp' { return 'image/webp' }
        '.png'  { return 'image/png' }
        '.jpg'  { return 'image/jpeg' }
        '.jpeg' { return 'image/jpeg' }
        '.svg'  { return 'image/svg+xml' }
        '.woff' { return 'font/woff' }
        '.woff2'{ return 'font/woff2' }
        default { return 'application/octet-stream' }
    }
}

function Send-Response($Stream, [int]$Status, [string]$StatusText, [byte[]]$Body, [string]$ContentType) {
    if ($null -eq $Body) { $Body = [byte[]]@() }
    $Header = "HTTP/1.1 $Status $StatusText`r`nContent-Type: $ContentType`r`nContent-Length: $($Body.Length)`r`nCache-Control: no-cache`r`nConnection: close`r`n`r`n"
    $HeaderBytes = [System.Text.Encoding]::ASCII.GetBytes($Header)
    $Stream.Write($HeaderBytes, 0, $HeaderBytes.Length)
    if ($Body.Length -gt 0) { $Stream.Write($Body, 0, $Body.Length) }
    $Stream.Flush()
}

try {
    $Listener.Start()
} catch {
    Write-Host "Impossibile avviare Fantallenatore sulla porta $Port." -ForegroundColor Red
    Write-Host "Chiudi eventuali copie gia aperte e riprova." -ForegroundColor Yellow
    Read-Host "Premi INVIO per chiudere"
    exit 1
}

$Url = "http://127.0.0.1:$Port/index.html"
Write-Host "Fantallenatore avviato su $Url" -ForegroundColor Green
Write-Host "Lascia aperta questa finestra mentre giochi. Premi CTRL+C per fermare il server." -ForegroundColor DarkGray
Start-Process $Url

try {
    while ($true) {
        $Client = $Listener.AcceptTcpClient()
        try {
            $Stream = $Client.GetStream()
            $Reader = New-Object System.IO.StreamReader -ArgumentList $Stream, ([System.Text.Encoding]::ASCII), $false, 4096, $true
            $RequestLine = $Reader.ReadLine()
            if ([string]::IsNullOrWhiteSpace($RequestLine)) { continue }
            do { $Line = $Reader.ReadLine() } while ($null -ne $Line -and $Line -ne '')

            $Parts = $RequestLine.Split(' ')
            if ($Parts.Length -lt 2 -or $Parts[0] -ne 'GET') {
                Send-Response $Stream 405 'Method Not Allowed' ([System.Text.Encoding]::UTF8.GetBytes('Method Not Allowed')) 'text/plain; charset=utf-8'
                continue
            }

            $RawPath = $Parts[1].Split('?')[0]
            $UrlPath = [System.Uri]::UnescapeDataString($RawPath)
            if ($UrlPath -eq '/') { $UrlPath = '/index.html' }
            $RelativePath = $UrlPath.TrimStart('/').Replace('/', [System.IO.Path]::DirectorySeparatorChar)
            $FullPath = [System.IO.Path]::GetFullPath((Join-Path $Root $RelativePath))

            if (-not $FullPath.StartsWith($Root, [System.StringComparison]::OrdinalIgnoreCase)) {
                Send-Response $Stream 403 'Forbidden' ([System.Text.Encoding]::UTF8.GetBytes('Forbidden')) 'text/plain; charset=utf-8'
                continue
            }

            if (Test-Path -LiteralPath $FullPath -PathType Leaf) {
                $Bytes = [System.IO.File]::ReadAllBytes($FullPath)
                Send-Response $Stream 200 'OK' $Bytes (Get-ContentType $FullPath)
            } else {
                Send-Response $Stream 404 'Not Found' ([System.Text.Encoding]::UTF8.GetBytes('Not Found')) 'text/plain; charset=utf-8'
            }
        } catch {
            Write-Host "Errore richiesta: $($_.Exception.Message)" -ForegroundColor DarkYellow
        } finally {
            if ($null -ne $Client) { $Client.Close() }
        }
    }
} finally {
    $Listener.Stop()
}
