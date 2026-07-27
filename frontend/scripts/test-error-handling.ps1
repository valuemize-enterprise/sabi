# PowerShell script to test error handling
# Run: .\scripts\test-error-handling.ps1

Write-Host "🧪 Testing Error Handling Implementation" -ForegroundColor Cyan
Write-Host "=" * 80
Write-Host ""

# Test 1: Check if error handler files exist
Write-Host "✓ Checking if error handler files exist..." -ForegroundColor Yellow
$files = @(
    "src\lib\errorHandler.ts",
    "src\lib\safeRequest.ts"
)

foreach ($file in $files) {
    if (Test-Path $file) {
        Write-Host "  ✓ $file exists" -ForegroundColor Green
    } else {
        Write-Host "  ✗ $file missing!" -ForegroundColor Red
    }
}

Write-Host ""

# Test 2: Count remaining throw new Error instances
Write-Host "✓ Counting remaining 'throw new Error' instances..." -ForegroundColor Yellow
try {
    $count = (Select-String -Path "src\**\*.tsx","src\**\*.ts" -Pattern "throw new Error" -Recurse | Measure-Object).Count
    Write-Host "  Found $count instances" -ForegroundColor $(if ($count -gt 0) { "Yellow" } else { "Green" })
} catch {
    Write-Host "  Could not count instances" -ForegroundColor Red
}

Write-Host ""

# Test 3: Check if toast is installed
Write-Host "✓ Checking if react-hot-toast is installed..." -ForegroundColor Yellow
if (Test-Path "package.json") {
    $packageJson = Get-Content "package.json" -Raw | ConvertFrom-Json
    if ($packageJson.dependencies."react-hot-toast") {
        Write-Host "  ✓ react-hot-toast installed: v$($packageJson.dependencies.'react-hot-toast')" -ForegroundColor Green
    } else {
        Write-Host "  ✗ react-hot-toast not found in package.json" -ForegroundColor Red
    }
}

Write-Host ""

# Test 4: List files that still need updates
Write-Host "✓ Files that still need updates:" -ForegroundColor Yellow
Write-Host "  High Priority (User-Facing):" -ForegroundColor Cyan
$highPriority = @(
    "src\app\(internal)\my-profile\page.tsx",
    "src\app\(internal)\settings\users\page.tsx",
    "src\components\goals\types.ts",
    "src\components\people\types.ts"
)

foreach ($file in $highPriority) {
    if (Test-Path $file) {
        $hasError = Select-String -Path $file -Pattern "throw new Error" -Quiet
        if ($hasError) {
            Write-Host "  ❌ $file" -ForegroundColor Red
        } else {
            Write-Host "  ✓ $file (already fixed)" -ForegroundColor Green
        }
    }
}

Write-Host ""
Write-Host "=" * 80
Write-Host "📖 For migration instructions, see ERROR_HANDLING_GUIDE.md" -ForegroundColor Cyan
Write-Host ""
