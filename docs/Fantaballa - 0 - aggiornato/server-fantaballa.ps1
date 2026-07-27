param(
    [Parameter(Mandatory = $true)]
    [string]$Root,

    [Parameter(Mandatory = $true)]
    [string]$Page,

    [int]$StartPort = 8000
)

$ErrorActionPreference = 'Stop'

function Get-FreePort {
    param([int]$FromPort)

    foreach ($port in $FromPort..($FromPort + 30)) {
        $probe = $null
        try {
            $probe = [System.Net.Sockets.TcpListener]::new(
                [System.Net.IPAddress]::Loopback,
                $port
            )
            $probe.Start()
            $probe.Stop()
            return $port
        }
        catch {
            if ($null -ne $probe) {
                try { $probe.Stop() } catch {}
            }
        }
    }

    throw "Nessuna porta libera trovata tra $FromPort e $($FromPort + 30)."
}

function Get-ContentType {
    param([string]$Path)

    switch ([System.IO.Path]::GetExtension($Path).ToLowerInvariant()) {
        '.html'  { return 'text/html; charset=utf-8' }
        '.htm'   { return 'text/html; charset=utf-8' }
        '.css'   { return 'text/css; charset=utf-8' }
        '.js'    { return 'application/javascript; charset=utf-8' }
        '.json'  { return 'application/json; charset=utf-8' }
        '.svg'   { return 'image/svg+xml' }
        '.png'   { return 'image/png' }
        '.jpg'   { return 'image/jpeg' }
        '.jpeg'  { return 'image/jpeg' }
        '.webp'  { return 'image/webp' }
        '.gif'   { return 'image/gif' }
        '.ico'   { return 'image/x-icon' }
        '.woff'  { return 'font/woff' }
        '.woff2' { return 'font/woff2' }
        '.ttf'   { return 'font/ttf' }
        '.mp3'   { return 'audio/mpeg' }
        '.wav'   { return 'audio/wav' }
        '.mp4'   { return 'video/mp4' }
        '.webm'  { return 'video/webm' }
        '.xml'   { return 'application/xml; charset=utf-8' }
        '.txt'   { return 'text/plain; charset=utf-8' }
        default  { return 'application/octet-stream' }
    }
}

function Write-Response {
    param(
        [System.Net.Sockets.NetworkStream]$Stream,
        [int]$StatusCode,
        [string]$StatusText,
        [byte[]]$Body,
        [string]$ContentType,
        [bool]$SendBody = $true
    )

    $headers = @(
        "HTTP/1.1 $StatusCode $StatusText"
        "Content-Type: $ContentType"
        "Content-Length: $($Body.Length)"
        'Cache-Control: no-store, no-cache, must-revalidate'
        'Pragma: no-cache'
        'Access-Control-Allow-Origin: *'
        'Connection: close'
        ''
        ''
    ) -join "`r`n"

    $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($headers)
    $Stream.Write($headerBytes, 0, $headerBytes.Length)

    if ($SendBody -and $Body.Length -gt 0) {
        $Stream.Write($Body, 0, $Body.Length)
    }

    $Stream.Flush()
}

$rootFull = [System.IO.Path]::GetFullPath($Root)
if (-not $rootFull.EndsWith([System.IO.Path]::DirectorySeparatorChar)) {
    $rootFull += [System.IO.Path]::DirectorySeparatorChar
}

$pagePath = [System.IO.Path]::GetFullPath((Join-Path $Root $Page))
if (-not (Test-Path -LiteralPath $pagePath -PathType Leaf)) {
    throw "Il file '$Page' non esiste nella cartella del progetto."
}

$port = Get-FreePort -FromPort $StartPort
$listener = [System.Net.Sockets.TcpListener]::new(
    [System.Net.IPAddress]::Loopback,
    $port
)

try {
    $listener.Start()

    $url = "http://localhost:$port/$Page"
    Write-Host '==============================================' -ForegroundColor DarkMagenta
    Write-Host '       FANTABALLA - SERVER LOCALE ATTIVO' -ForegroundColor Magenta
    Write-Host '==============================================' -ForegroundColor DarkMagenta
    Write-Host ''
    Write-Host "Cartella: $Root" -ForegroundColor Gray
    Write-Host "Pagina:   $Page" -ForegroundColor Gray
    Write-Host ''
    Write-Host "Anteprima: $url" -ForegroundColor Cyan
    Write-Host ''
    Write-Host 'LASCIA APERTA QUESTA FINESTRA.' -ForegroundColor Yellow
    Write-Host 'Per terminare premi CTRL+C oppure chiudila.' -ForegroundColor Gray
    Write-Host ''

    Start-Process $url

    while ($true) {
        $client = $listener.AcceptTcpClient()
        try {
            $client.ReceiveTimeout = 5000
            $client.SendTimeout = 5000
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
            if ($parts.Length -lt 2) {
                $body = [System.Text.Encoding]::UTF8.GetBytes('Richiesta non valida')
                Write-Response -Stream $stream -StatusCode 400 -StatusText 'Bad Request' -Body $body -ContentType 'text/plain; charset=utf-8'
                continue
            }

            $method = $parts[0].ToUpperInvariant()
            $rawTarget = $parts[1]
            $sendBody = $method -ne 'HEAD'

            if ($method -ne 'GET' -and $method -ne 'HEAD') {
                $body = [System.Text.Encoding]::UTF8.GetBytes('Metodo non supportato')
                Write-Response -Stream $stream -StatusCode 405 -StatusText 'Method Not Allowed' -Body $body -ContentType 'text/plain; charset=utf-8' -SendBody $sendBody
                continue
            }

            $pathOnly = $rawTarget.Split('?')[0]
            $decoded = [System.Uri]::UnescapeDataString($pathOnly)
            $relative = $decoded.TrimStart('/').Replace('/', [System.IO.Path]::DirectorySeparatorChar)

            if ([string]::IsNullOrWhiteSpace($relative)) {
                $relative = $Page
            }

            $fullPath = [System.IO.Path]::GetFullPath((Join-Path $Root $relative))
            if (-not $fullPath.StartsWith($rootFull, [System.StringComparison]::OrdinalIgnoreCase)) {
                $body = [System.Text.Encoding]::UTF8.GetBytes('Accesso negato')
                Write-Response -Stream $stream -StatusCode 403 -StatusText 'Forbidden' -Body $body -ContentType 'text/plain; charset=utf-8' -SendBody $sendBody
                continue
            }

            if (Test-Path -LiteralPath $fullPath -PathType Container) {
                $fullPath = Join-Path $fullPath 'index.html'
            }

            if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) {
                $body = [System.Text.Encoding]::UTF8.GetBytes("File non trovato: $decoded")
                Write-Response -Stream $stream -StatusCode 404 -StatusText 'Not Found' -Body $body -ContentType 'text/plain; charset=utf-8' -SendBody $sendBody
                continue
            }

            $bytes = [System.IO.File]::ReadAllBytes($fullPath)
            $contentType = Get-ContentType -Path $fullPath
            Write-Response -Stream $stream -StatusCode 200 -StatusText 'OK' -Body $bytes -ContentType $contentType -SendBody $sendBody
        }
        catch {
            try {
                $stream = $client.GetStream()
                $message = [System.Text.Encoding]::UTF8.GetBytes("Errore server: $($_.Exception.Message)")
                Write-Response -Stream $stream -StatusCode 500 -StatusText 'Internal Server Error' -Body $message -ContentType 'text/plain; charset=utf-8'
            }
            catch {}
        }
        finally {
            try { $client.Close() } catch {}
        }
    }
}
finally {
    try { $listener.Stop() } catch {}
}
