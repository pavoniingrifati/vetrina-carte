param(
    [int]$Port = 8765,
    [string]$Root = $PSScriptRoot
)

$ErrorActionPreference = "Stop"
$Root = [System.IO.Path]::GetFullPath($Root)

$mime = @{
    ".html"  = "text/html; charset=utf-8"
    ".css"   = "text/css; charset=utf-8"
    ".js"    = "application/javascript; charset=utf-8"
    ".json"  = "application/json; charset=utf-8"
    ".png"   = "image/png"
    ".jpg"   = "image/jpeg"
    ".jpeg"  = "image/jpeg"
    ".webp"  = "image/webp"
    ".svg"   = "image/svg+xml"
    ".ico"   = "image/x-icon"
    ".woff"  = "font/woff"
    ".woff2" = "font/woff2"
    ".txt"   = "text/plain; charset=utf-8"
}

function Write-Response {
    param(
        [System.Net.Sockets.NetworkStream]$Stream,
        [int]$Status,
        [string]$StatusText,
        [byte[]]$Body,
        [string]$ContentType = "text/plain; charset=utf-8",
        [bool]$HeadOnly = $false
    )

    $header = "HTTP/1.1 $Status $StatusText`r`n" +
              "Content-Type: $ContentType`r`n" +
              "Content-Length: $($Body.Length)`r`n" +
              "Cache-Control: no-store, no-cache, must-revalidate`r`n" +
              "Access-Control-Allow-Origin: *`r`n" +
              "Connection: close`r`n`r`n"

    $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
    $Stream.Write($headerBytes, 0, $headerBytes.Length)
    if (-not $HeadOnly -and $Body.Length -gt 0) {
        $Stream.Write($Body, 0, $Body.Length)
    }
}

$listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $Port)
$listener.Start()

Write-Host ""
Write-Host "=============================================="
Write-Host " FANTABALLA - SERVER DI TEST"
Write-Host "=============================================="
Write-Host " http://127.0.0.1:$Port/"
Write-Host ""
Write-Host "Chiudi questa finestra per fermare il server."
Write-Host ""

try {
    while ($true) {
        $client = $listener.AcceptTcpClient()
        try {
            $stream = $client.GetStream()
            $reader = New-Object System.IO.StreamReader($stream,[System.Text.Encoding]::ASCII,$false,4096,$true)
            $requestLine = $reader.ReadLine()
            if ([string]::IsNullOrWhiteSpace($requestLine)) { continue }
            while ($true) {
                $line = $reader.ReadLine()
                if ([string]::IsNullOrEmpty($line)) { break }
            }

            if ($requestLine -notmatch '^(GET|HEAD)\s+([^\s]+)') {
                $body = [System.Text.Encoding]::UTF8.GetBytes("405 Method Not Allowed")
                Write-Response $stream 405 "Method Not Allowed" $body
                continue
            }

            $method = $Matches[1]
            $requestTarget = $Matches[2].Split("?")[0]
            $relative = [System.Uri]::UnescapeDataString($requestTarget).TrimStart("/")
            if ([string]::IsNullOrWhiteSpace($relative)) { $relative = "index.html" }
            $relative = $relative -replace '/', [System.IO.Path]::DirectorySeparatorChar
            $candidate = [System.IO.Path]::GetFullPath((Join-Path $Root $relative))
            $rootPrefix = $Root.TrimEnd('\','/') + [System.IO.Path]::DirectorySeparatorChar

            if (($candidate -ne $Root) -and (-not $candidate.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase))) {
                $body = [System.Text.Encoding]::UTF8.GetBytes("403 Forbidden")
                Write-Response $stream 403 "Forbidden" $body
                continue
            }

            if (-not (Test-Path -LiteralPath $candidate -PathType Leaf)) {
                $body = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
                Write-Response $stream 404 "Not Found" $body
                continue
            }

            $bytes = [System.IO.File]::ReadAllBytes($candidate)
            $ext = [System.IO.Path]::GetExtension($candidate).ToLowerInvariant()
            $type = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { "application/octet-stream" }
            Write-Response $stream 200 "OK" $bytes $type ($method -eq "HEAD")
        }
        catch {
            try {
                $body = [System.Text.Encoding]::UTF8.GetBytes("500 Server Error")
                Write-Response $stream 500 "Server Error" $body
            } catch {}
        }
        finally {
            $client.Close()
        }
    }
}
finally {
    $listener.Stop()
}
