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

Print-Info "Downloading wixtoolset..."
# choco install wixtoolset --yes
$WebClient = New-Object System.Net.WebClient
#$WebClient.DownloadFile("https://github.com/wixtoolset/wix3/releases/download/wix3111rtm/wix311.exe",".\scripts\wix.exe")
$WebClient.DownloadFile("https://github.com/wixtoolset/wix3/releases/download/wix3104rtm/wix310.exe",".\scripts\wix.exe"
Print-Info "Installing wixtoolset..."
# todo: check hash
.\scripts\wix.exe -q
Print-Info "wixtoolset installed!"