param(
    [int]$Port = 8000
)

$ErrorActionPreference = 'Stop'
$Root = [System.IO.Path]::GetFullPath((Split-Path -Parent $MyInvocation.MyCommand.Path))
$Prefix = "http://localhost:$Port/"

function Get-ContentType([string]$Path) {
    switch ([System.IO.Path]::GetExtension($Path).ToLowerInvariant()) {
        '.html' { 'text/html; charset=utf-8' }
        '.htm'  { 'text/html; charset=utf-8' }
        '.css'  { 'text/css; charset=utf-8' }
        '.js'   { 'application/javascript; charset=utf-8' }
        '.json' { 'application/json; charset=utf-8' }
        '.svg'  { 'image/svg+xml' }
        '.png'  { 'image/png' }
        '.jpg'  { 'image/jpeg' }
        '.jpeg' { 'image/jpeg' }
        '.webp' { 'image/webp' }
        '.gif'  { 'image/gif' }
        '.ico'  { 'image/x-icon' }
        '.woff' { 'font/woff' }
        '.woff2'{ 'font/woff2' }
        '.ttf'  { 'font/ttf' }
        '.mp4'  { 'video/mp4' }
        default { 'application/octet-stream' }
    }
}

$Listener = New-Object System.Net.HttpListener
$Listener.Prefixes.Add($Prefix)

try {
    $Listener.Start()
    Write-Host "Sito disponibile su $Prefix" -ForegroundColor Green
    Write-Host 'Lascia aperta questa finestra mentre lavori.'
    Write-Host 'Per chiudere il server premi CTRL+C.'
    Write-Host ''

    Start-Process $Prefix

    while ($Listener.IsListening) {
        $Context = $Listener.GetContext()
        $Request = $Context.Request
        $Response = $Context.Response

        try {
            $RelativePath = [System.Uri]::UnescapeDataString($Request.Url.AbsolutePath.TrimStart('/'))
            if ([string]::IsNullOrWhiteSpace($RelativePath)) {
                $RelativePath = 'index.html'
            }

            $RequestedPath = Join-Path $Root ($RelativePath -replace '/', [System.IO.Path]::DirectorySeparatorChar)
            $FullPath = [System.IO.Path]::GetFullPath($RequestedPath)

            if (-not $FullPath.StartsWith($Root, [System.StringComparison]::OrdinalIgnoreCase)) {
                $Response.StatusCode = 403
                $Payload = [System.Text.Encoding]::UTF8.GetBytes('403 - Accesso negato')
            }
            else {
                if (Test-Path $FullPath -PathType Container) {
                    $FullPath = Join-Path $FullPath 'index.html'
                }

                if (Test-Path $FullPath -PathType Leaf) {
                    $Payload = [System.IO.File]::ReadAllBytes($FullPath)
                    $Response.StatusCode = 200
                    $Response.ContentType = Get-ContentType $FullPath
                    $Response.Headers['Cache-Control'] = 'no-store, no-cache, must-revalidate'
                }
                else {
                    $Response.StatusCode = 404
                    $Payload = [System.Text.Encoding]::UTF8.GetBytes('404 - File non trovato')
                    $Response.ContentType = 'text/plain; charset=utf-8'
                }
            }

            $Response.ContentLength64 = $Payload.Length
            if ($Request.HttpMethod -ne 'HEAD') {
                $Response.OutputStream.Write($Payload, 0, $Payload.Length)
            }
        }
        catch {
            $Response.StatusCode = 500
            $Payload = [System.Text.Encoding]::UTF8.GetBytes("500 - Errore del server locale`r`n$($_.Exception.Message)")
            $Response.ContentType = 'text/plain; charset=utf-8'
            $Response.ContentLength64 = $Payload.Length
            $Response.OutputStream.Write($Payload, 0, $Payload.Length)
        }
        finally {
            $Response.OutputStream.Close()
        }
    }
}
catch [System.Net.HttpListenerException] {
    Write-Host ''
    Write-Host "Impossibile avviare il server sulla porta $Port." -ForegroundColor Red
    Write-Host 'La porta potrebbe essere gia occupata da un altro programma.'
    Write-Host 'Chiudi eventuali vecchie finestre del server e riprova.'
    exit 1
}
catch {
    Write-Host ''
    Write-Host 'Errore durante l avvio del server locale:' -ForegroundColor Red
    Write-Host $_.Exception.Message
    exit 1
}
finally {
    if ($Listener -and $Listener.IsListening) {
        $Listener.Stop()
    }
    if ($Listener) {
        $Listener.Close()
    }
}
