# Moodle MCP - Setup Script for Claude Code
# ---------------------------------------------
# Automatically registers Moodle instances in Claude Code.

Write-Host "`n[Moodle MCP] Configuring for Claude Code..." -ForegroundColor Cyan

# 1. Get absolute project path
$ProjectRoot = Get-Item "." | Select-Object -ExpandProperty FullName
$ServerPath = Join-Path $ProjectRoot "dist\server.js"

if (-not (Test-Path $ServerPath)) {
    Write-Host "[!] Error: 'dist\server.js' not found. Please run 'npm run build' first." -ForegroundColor Red
    exit 1
}

# 2. Detect .env.* instances
$Instances = Get-ChildItem -Path "." -Filter ".env.*" | Where-Object { $_.Name -ne ".env.example" }

if ($Instances.Count -eq 0) {
    Write-Host "[!] Error: No .env.moodleX files found." -ForegroundColor Red
    exit 1
}

Write-Host "[i] Found $($Instances.Count) Moodle instances."

# 3. Register each instance in Claude Code
foreach ($InstanceFile in $Instances) {
    $InstanceName = $InstanceFile.Name.Replace(".env.", "")
    
    Write-Host "[+] Registering mcp:$InstanceName in Claude..." -NoNewline
    
    # Try using the native 'claude mcp add' command
    # Note: Claude Code usually uses the ~/.claude.json file for global
    # or .mcp.json for local. The CLI command is the safest way.
    & claude mcp add $InstanceName node "`"$ServerPath`"" --env "MOODLE_INSTANCE=$InstanceName" 2>&1 | Out-Null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host " [OK]" -ForegroundColor Green
    } else {
        Write-Host " [FAILED]" -ForegroundColor Red
        Write-Host "    (Make sure you have claude-code installed)" -ForegroundColor Gray
    }
}

Write-Host "`n[✓] Configuration completed! You can now use the tools in Claude Code.`n" -ForegroundColor Cyan
