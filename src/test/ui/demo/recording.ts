import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { VSBrowser } from 'vscode-extension-tester';

// From out/test/ui/demo/ go 4 levels up to project root
const RESULTS_DIR = path.resolve(__dirname, '../../../../test-results');
const FRAME_INTERVAL_MS = 250;

type RecordingOutput = {
    filename: string;
    framerate: number;
    videoFilter?: string;
};

export class UiRecording {
    private readonly framesDir: string;
    private readonly outputs: RecordingOutput[];
    private frameIndex = 0;
    private stepIndex = 0;
    private active = false;

    constructor(name: string, outputs?: RecordingOutput[]) {
        this.framesDir = path.join(RESULTS_DIR, `${name}-frames`);
        this.outputs = outputs ?? [{ filename: `${name}.mp4`, framerate: 4 }];
    }

    start(): void {
        fs.mkdirSync(RESULTS_DIR, { recursive: true });
        fs.rmSync(this.framesDir, { recursive: true, force: true });
        fs.mkdirSync(this.framesDir, { recursive: true });
        this.frameIndex = 0;
        this.stepIndex = 0;
        this.active = true;
    }

    async step(label: string, ms = 1_200): Promise<void> {
        if (!this.active) { return; }
        this.stepIndex += 1;
        await this.showStepLabel(`${this.stepIndex}. ${label}`);
        const end = Date.now() + ms;
        do {
            await this.captureFrame();
            const remaining = end - Date.now();
            if (remaining > 0) {
                await new Promise(resolve => setTimeout(resolve, Math.min(FRAME_INTERVAL_MS, remaining)));
            }
        } while (Date.now() < end);
    }

    async pause(ms = 1_000): Promise<void> {
        if (!this.active) { return; }
        const end = Date.now() + ms;
        do {
            await this.captureFrame();
            const remaining = end - Date.now();
            if (remaining > 0) {
                await new Promise(resolve => setTimeout(resolve, Math.min(FRAME_INTERVAL_MS, remaining)));
            }
        } while (Date.now() < end);
    }

    async stop(): Promise<void> {
        if (!this.active || this.frameIndex === 0) {
            this.active = false;
            return;
        }
        await this.captureFrame();
        this.active = false;
        for (const output of this.outputs) {
            await this.renderOutput(output);
        }
    }

    hideLabel(): Promise<void> {
        return VSBrowser.instance.driver.executeScript(`
            const el = document.getElementById('vt-demo-recording-step');
            if (el) el.remove();
        `) as Promise<void>;
    }

    private async captureFrame(): Promise<void> {
        const png = await VSBrowser.instance.driver.takeScreenshot();
        const frameName = `frame-${String(this.frameIndex).padStart(4, '0')}.png`;
        this.frameIndex += 1;
        fs.writeFileSync(path.join(this.framesDir, frameName), png, 'base64');
    }

    private async showStepLabel(label: string): Promise<void> {
        await VSBrowser.instance.driver.executeScript(`
            const id = 'vt-demo-recording-step';
            let banner = document.getElementById(id);
            if (!banner) {
                banner = document.createElement('div');
                banner.id = id;
                banner.style.position = 'fixed';
                banner.style.left = '16px';
                banner.style.bottom = '16px';
                banner.style.zIndex = '999999';
                banner.style.padding = '12px 16px';
                banner.style.width = '420px';
                banner.style.borderRadius = '4px';
                banner.style.background = 'rgba(255, 255, 255, 0.94)';
                banner.style.color = '#111111';
                banner.style.font = '600 14px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
                banner.style.boxShadow = '0 8px 28px rgba(0, 0, 0, 0.22)';
                banner.style.border = '1px solid rgba(0, 0, 0, 0.12)';
                banner.style.pointerEvents = 'none';
                document.body.appendChild(banner);
            }
            banner.textContent = arguments[0];
        `, label);
    }

    private renderOutput(output: RecordingOutput): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const args = [
                '-y',
                '-framerate', String(output.framerate),
                '-i', path.join(this.framesDir, 'frame-%04d.png'),
                '-vf', output.videoFilter ?? 'format=yuv420p',
                '-c:v', 'libx264',
                path.join(RESULTS_DIR, output.filename),
            ];
            const ffmpeg = spawn('ffmpeg', args, { stdio: 'ignore' });
            ffmpeg.on('error', reject);
            ffmpeg.on('close', code => {
                if (code === 0) { resolve(); } else { reject(new Error(`ffmpeg exited with code ${code}`)); }
            });
        });
    }

    static productDemo(name: string): UiRecording {
        return new UiRecording(name, [
            { filename: `${name}-raw.mp4`, framerate: 4 },
        ]);
    }
}
