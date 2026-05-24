# record-demo.ps1
# Runs a demo automation (screenshot-based recording inside the test) and
# converts the resulting MP4 to a GIF ready for the README.
#
# Prerequisites: ffmpeg on PATH
# Usage:
#   .\scripts\record-demo.ps1 -Demo a   # File Organization + AI Context
#   .\scripts\record-demo.ps1 -Demo c   # Persistence

param(
    [Parameter(Mandatory)][ValidateSet('a','c')] [string] $Demo
)

Write-Host "==> Running demo-$Demo automation ..."
npm run "test:ui:demo:$Demo"
if ($LASTEXITCODE -ne 0) {
    Write-Warning "Demo exited with code $LASTEXITCODE"
    exit $LASTEXITCODE
}

Write-Host "==> Converting to GIF ..."
npm run "demo:gif:$Demo"

$gifMap = @{ a = 'docs/assets/demo-organize.gif'; c = 'docs/assets/demo-persistence.gif' }
Write-Host ""
Write-Host "Done! GIF saved to: $($gifMap[$Demo])"
Write-Host "Review the GIF before committing:"
Write-Host "  1. Open the GIF in your browser to watch it loop"
Write-Host "  2. Check captions are readable and no private paths visible"
Write-Host "  3. Check the raw MP4 is in .gitignore (test-results/)"
