param(
    [string]$StartPage = 'direttore-sportivo.html',
    [int]$StartPort = 8000,
    [int]$EndPort = 8010
)

$ErrorActionPreference = 'Stop'

function Get-MimeType([string]$Path) {
    switch ([System.IO.Path]::GetExtension($Path).ToLowerInvariant()) {
        '.html' { return 'text/html; charset=utf-8' }
        '.htm'  { return 'text/html; charset=utf-8' }
        '.css'  { return 'text/css; charset=utf-8' }
        '.js'   { return 'application/javascript; charset=utf-8' }
        '.json' { return 'application/json; charset=utf-8' }
        '.xml'  { return 'application/xml; charset=utf-8' }
        '.txt'  { return 'text/plain; charset=utf-8' }
        '.svg'  { return 'image/svg+xml' }
        '.png'  { return 'image/png' }
        '.jpg'  { return 'image/jpeg' }
        '.jpeg' { return 'image/jpeg' }
        '.webp' { return 'image/webp' }
        '.gif'  { return 'image/gif' }
        '.ico'  { return 'image/x-icon' }
        '.woff' { return 'font/woff' }
        '.woff2'{ return 'font/woff2' }
        '.ttf'  { return 'font/ttf' }
        '.mp3'  { return 'audio/mpeg' }
        '.mp4'  { return 'video/mp4' }
        default { return 'application/octet-stream' }
    }
}

function Send-Response {
    param(
        [System.Net.Sockets.NetworkStream]$Stream,
        [int]$StatusCode,
        [string]$StatusText,
        [byte[]]$Body,
        [string]$ContentType = 'text/plain; charset=utf-8',
        [bool]$SendBody = $true
    )

    if ($null -eq $Body) { $Body = [byte[]]::new(0) }
    $headers = @(
        "HTTP/1.1 $StatusCode $StatusText",
        "Content-Type: $ContentType",
        "Content-Length: $($Body.Length)",
        'Cache-Control: no-store, no-cache, must-revalidate',
        'Pragma: no-cache',
        'X-Content-Type-Options: nosniff',
        'Connection: close',
        '',
        ''
    ) -join "`r`n"

    $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($headers)
    $Stream.Write($headerBytes, 0, $headerBytes.Length)
    if ($SendBody -and $Body.Length -gt 0) {
        $Stream.Write($Body, 0, $Body.Length)
    }
    $Stream.Flush()
}

$rootPath = (Resolve-Path -LiteralPath $PSScriptRoot).Path
$startFile = Join-Path $rootPath $StartPage

if (-not (Test-Path -LiteralPath $startFile -PathType Leaf)) {
    Write-Host ''
    Write-Host "[ERRORE] Non trovo $StartPage." -ForegroundColor Red
    Write-Host 'Metti AVVIA_ANTEPRIMA.bat e AVVIA_ANTEPRIMA.ps1 nella cartella principale di Fantaballa.'
    exit 1
}

$listener = $null
$port = $null

foreach ($candidate in $StartPort..$EndPort) {
    try {
        $testListener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $candidate)
        $testListener.Start()
        $listener = $testListener
        $port = $candidate
        break
    }
    catch {
        if ($testListener) {
            try { $testListener.Stop() } catch {}
        }
    }
}

if (-not $listener -or -not $port) {
    Write-Host ''
    Write-Host "[ERRORE] Le porte dalla $StartPort alla $EndPort risultano occupate." -ForegroundColor Red
    Write-Host 'Chiudi eventuali anteprime gia aperte e riprova.'
    exit 1
}

$previewUrl = "http://127.0.0.1:$port/$StartPage"

Clear-Host
Write-Host '============================================================'
Write-Host '            FANTABALLA - ANTEPRIMA OFFLINE'
Write-Host '============================================================'
Write-Host ''
Write-Host 'Pagina:    Modalita Direttore Sportivo'
Write-Host "Indirizzo: $previewUrl"
Write-Host "Cartella:  $rootPath"
Write-Host ''
Write-Host 'Il browser si aprira automaticamente.'
Write-Host 'Per chiudere il server premi CTRL+C in questa finestra.'
Write-Host '============================================================'
Write-Host ''

Start-Sleep -Milliseconds 350
Start-Process $previewUrl

try {
    while ($true) {
        $client = $listener.AcceptTcpClient()
        try {
            $stream = $client.GetStream()
            $reader = [System.IO.StreamReader]::new(
                $stream,
                [System.Text.Encoding]::ASCII,
                $false,
                4096,
                $true
            )

            $requestLine = $reader.ReadLine()
            if ([string]::IsNullOrWhiteSpace($requestLine)) {
                continue
            }

            while ($true) {
                $headerLine = $reader.ReadLine()
                if ([string]::IsNullOrEmpty($headerLine)) { break }
            }

            $parts = $requestLine.Split(' ')
            if ($parts.Count -lt 2) {
                $body = [System.Text.Encoding]::UTF8.GetBytes('Richiesta non valida.')
                Send-Response -Stream $stream -StatusCode 400 -StatusText 'Bad Request' -Body $body
                continue
            }

            $method = $parts[0].ToUpperInvariant()
            if ($method -ne 'GET' -and $method -ne 'HEAD') {
                $body = [System.Text.Encoding]::UTF8.GetBytes('Metodo non supportato.')
                Send-Response -Stream $stream -StatusCode 405 -StatusText 'Method Not Allowed' -Body $body -SendBody ($method -ne 'HEAD')
                continue
            }

            $rawPath = $parts[1].Split('?')[0]
            try {
                $decodedPath = [System.Uri]::UnescapeDataString($rawPath)
            }
            catch {
                $decodedPath = $rawPath
            }

            if ([string]::IsNullOrWhiteSpace($decodedPath) -or $decodedPath -eq '/') {
                $decodedPath = '/' + $StartPage
            }

            $relativePath = $decodedPath.TrimStart('/').Replace('/', [System.IO.Path]::DirectorySeparatorChar)
            $requestedPath = [System.IO.Path]::GetFullPath((Join-Path $rootPath $relativePath))
            $rootPrefix = $rootPath.TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar

            if (-not $requestedPath.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase) -and
                -not $requestedPath.Equals($rootPath, [System.StringComparison]::OrdinalIgnoreCase)) {
                $body = [System.Text.Encoding]::UTF8.GetBytes('Accesso negato.')
                Send-Response -Stream $stream -StatusCode 403 -StatusText 'Forbidden' -Body $body -SendBody ($method -ne 'HEAD')
                continue
            }

            if (Test-Path -LiteralPath $requestedPath -PathType Container) {
                $requestedPath = Join-Path $requestedPath 'index.html'
            }

            if (-not (Test-Path -LiteralPath $requestedPath -PathType Leaf)) {
                $body = [System.Text.Encoding]::UTF8.GetBytes('File non trovato.')
                Send-Response -Stream $stream -StatusCode 404 -StatusText 'Not Found' -Body $body -SendBody ($method -ne 'HEAD')
                continue
            }

            $bytes = [System.IO.File]::ReadAllBytes($requestedPath)
            Send-Response -Stream $stream -StatusCode 200 -StatusText 'OK' -Body $bytes -ContentType (Get-MimeType $requestedPath) -SendBody ($method -ne 'HEAD')
        }
        catch {
            try {
                if ($stream -and $stream.CanWrite) {
                    $body = [System.Text.Encoding]::UTF8.GetBytes('Errore interno del server locale.')
                    Send-Response -Stream $stream -StatusCode 500 -StatusText 'Internal Server Error' -Body $body
                }
            }
            catch {}
        }
        finally {
            try { if ($reader) { $reader.Dispose() } } catch {}
            try { if ($stream) { $stream.Dispose() } } catch {}
            try { $client.Close() } catch {}
        }
    }
}
finally {
    try { $listener.Stop() } catch {}
}
