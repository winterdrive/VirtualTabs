const fs = require('fs')
const path = require('path')

const outDir = path.join(process.cwd(), 'test-results')
fs.mkdirSync(outDir, { recursive: true })

const settings = {
    'window.zoomLevel': 2,
    'workbench.startupEditor': 'none',
    'workbench.welcomePage.walkthroughs.openOnInstall': false,
    'workbench.tips.enabled': false,
    'telemetry.telemetryLevel': 'off',
}

fs.writeFileSync(
    path.join(outDir, 'demo-vscode-settings.generated.json'),
    JSON.stringify(settings, null, 2)
)
