function Print-Info {
    Param (
        [String]$message,
        [Switch]$NoNewLine
    )
    if ([String]::IsNullOrEmpty($message)) {
        return
    }

    Write-Host "[" -NoNewLine
    Write-Host "+" -NoNewLine -ForegroundColor Green
    Write-Host "]" -NoNewLine

    if ($NoNewLine) {
        Write-Host " $message" -NoNewLine
    } else {
        Write-Host " $message"
    }
}

Print-Info "Installing wixtoolset..."
# choco install wixtoolset --yes
$WebClient = New-Object System.Net.WebClient
$WebClient.DownloadFile("https://github.com/wixtoolset/wix3/releases/download/wix3111rtm/wix311.exe",".\scripts\wix311.exe")
# todo: check hash
.\scripts\wix311.exe -q