# PowerShell script to transfer files to Ubuntu server
# Usage: .\scripts\deploy-to-server.ps1

param(
    [string]$ServerIP = "192.168.1.39",
    [string]$Username = "administrator",
    [string]$SshKeyPath = "",
    [string]$RemotePath = "/var/www/ledcontrol"
)

$ErrorActionPreference = "Stop"

Write-Host "🚀 WLED Control Interface - Server Deployment Transfer" -ForegroundColor Cyan
Write-Host ""

# Check if SSH is available
if (-not (Get-Command ssh -ErrorAction SilentlyContinue)) {
    Write-Host "❌ SSH command not found. Please install OpenSSH client." -ForegroundColor Red
    Write-Host "   Install via: Add-WindowsCapability -Online -Name OpenSSH.Client~~~~0.0.1.0" -ForegroundColor Yellow
    exit 1
}

# Build SCP command
$scpArgs = @()

if ($SshKeyPath -ne "") {
    if (-not (Test-Path $SshKeyPath)) {
        Write-Host "❌ SSH key not found: $SshKeyPath" -ForegroundColor Red
        exit 1
    }
    $scpArgs += "-i"
    $scpArgs += $SshKeyPath
}

# Exclude unnecessary files/directories
$excludePatterns = @(
    "node_modules",
    ".git",
    "dist",
    ".env",
    ".env.*",
    "*.log",
    ".vscode",
    ".idea",
    "*.swp",
    "*.swo",
    "*~"
)

Write-Host "📦 Creating temporary archive..." -ForegroundColor Yellow

$tempArchive = Join-Path $env:TEMP "ledcontrol-deploy-$(Get-Date -Format 'yyyyMMdd-HHmmss').tar.gz"

# Use tar to create archive (available in Windows 10+)
try {
    # Create a temporary directory with files to transfer
    $tempDir = Join-Path $env:TEMP "ledcontrol-temp-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
    
    Write-Host "   Copying files (excluding node_modules, .git, etc.)..." -ForegroundColor Gray
    
    # Copy files excluding patterns
    Get-ChildItem -Path . -Recurse | Where-Object {
        $relativePath = $_.FullName.Substring((Get-Location).Path.Length + 1)
        $shouldExclude = $false
        foreach ($pattern in $excludePatterns) {
            if ($relativePath -like "*\$pattern\*" -or $relativePath -like "$pattern\*") {
                $shouldExclude = $true
                break
            }
        }
        -not $shouldExclude
    } | ForEach-Object {
        $destPath = $_.FullName.Replace((Get-Location).Path, $tempDir)
        $destDir = Split-Path $destPath -Parent
        if (-not (Test-Path $destDir)) {
            New-Item -ItemType Directory -Path $destDir -Force | Out-Null
        }
        Copy-Item $_.FullName -Destination $destPath -Force
    }
    
    Write-Host "   Creating archive..." -ForegroundColor Gray
    # Create tar.gz archive
    $tarArgs = @("czf", $tempArchive, "-C", $tempDir, ".")
    & tar $tarArgs
    
    Remove-Item -Path $tempDir -Recurse -Force
    
    Write-Host "✅ Archive created: $tempArchive" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to create archive: $_" -ForegroundColor Red
    Write-Host "   Trying alternative method (direct rsync/scp)..." -ForegroundColor Yellow
    
    # Fallback: use rsync if available, otherwise scp
    if (Get-Command rsync -ErrorAction SilentlyContinue) {
        Write-Host "   Using rsync..." -ForegroundColor Gray
        $rsyncArgs = @("-avz", "--exclude=node_modules", "--exclude=.git", "--exclude=dist", "--exclude=.env*")
        if ($SshKeyPath -ne "") {
            $rsyncArgs += "-e"
            $rsyncArgs += "ssh -i $SshKeyPath"
        }
        $rsyncArgs += "."
        $rsyncArgs += "${Username}@${ServerIP}:${RemotePath}/"
        
        & rsync $rsyncArgs
        $tempArchive = $null
    } else {
        Write-Host "❌ tar and rsync not available. Please transfer files manually." -ForegroundColor Red
        Write-Host "   Or install WSL and use: wsl rsync -avz ..." -ForegroundColor Yellow
        exit 1
    }
}

if ($tempArchive -ne $null -and (Test-Path $tempArchive)) {
    Write-Host ""
    Write-Host "📤 Transferring archive to server..." -ForegroundColor Yellow
    Write-Host "   Server: ${Username}@${ServerIP}" -ForegroundColor Gray
    Write-Host "   Remote path: ${RemotePath}" -ForegroundColor Gray
    
    # Transfer archive
    $scpTarget = "${Username}@${ServerIP}:${RemotePath}/ledcontrol-deploy.tar.gz"
    
    if ($SshKeyPath -ne "") {
        & scp -i $SshKeyPath $tempArchive $scpTarget
    } else {
        & scp $tempArchive $scpTarget
    }
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Archive transferred successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "📋 Next steps on server:" -ForegroundColor Cyan
        Write-Host "   1. SSH to server: ssh ${Username}@${ServerIP}" -ForegroundColor White
        Write-Host "   2. Extract archive:" -ForegroundColor White
        Write-Host "      cd ${RemotePath}" -ForegroundColor Gray
        Write-Host "      tar xzf ledcontrol-deploy.tar.gz" -ForegroundColor Gray
        Write-Host "      rm ledcontrol-deploy.tar.gz" -ForegroundColor Gray
        Write-Host "   3. Run deployment script:" -ForegroundColor White
        Write-Host "      chmod +x scripts/deploy.sh" -ForegroundColor Gray
        Write-Host "      ./scripts/deploy.sh" -ForegroundColor Gray
    } else {
        Write-Host "❌ Transfer failed. Please check your SSH connection." -ForegroundColor Red
        exit 1
    }
    
    # Cleanup
    Remove-Item $tempArchive -Force -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "✅ Transfer complete!" -ForegroundColor Green
