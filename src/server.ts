import express, { Request, Response } from 'express';
import cors from 'cors';
import { spawn, execSync } from 'child_process';
import path from 'path';
import os from 'os';

const app = express();
const PORT = 3001;

// ─── Environment Detection (runs once at startup) ────────────────────────────

function detectOS(): 'linux' | 'macos' | 'windows' {
    const p = os.platform();
    if (p === 'darwin') return 'macos';
    if (p === 'win32') return 'windows';
    return 'linux';
}

function which(bin: string): boolean {
    try {
        execSync(`which ${bin}`, { stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
}

function detectBrowsers(currentOS: 'linux' | 'macos' | 'windows'): string[] {
    const found: string[] = [];
    if (currentOS === 'linux') {
        // Check all known Linux binary names for each browser (including snap)
        const candidates = [
            'brave', 'brave-browser',          // Brave (snap installs as 'brave')
            'google-chrome', 'google-chrome-stable',
            'chromium', 'chromium-browser',
            'firefox',
            'microsoft-edge', 'microsoft-edge-stable',
        ];
        candidates.forEach(b => { if (which(b)) found.push(b); });
    } else if (currentOS === 'macos') {
        const apps = [
            ['/Applications/Brave Browser.app', 'brave'],
            ['/Applications/Google Chrome.app', 'chrome'],
            ['/Applications/Firefox.app', 'firefox'],
        ];
        apps.forEach(([p, name]) => {
            try { execSync(`test -d "${p}"`, { stdio: 'ignore' }); found.push(name); } catch { /* not installed */ }
        });
    } else {
        // Windows: optimistic defaults
        found.push('chrome', 'msedge');
    }
    return found;
}

// Browser command resolver — returns the shell command to open a URL
// Throws if the specific browser is requested but not found (we don't silently fallback)
function buildBrowserCommand(browserHint: string, url: string, currentOS: 'linux' | 'macos' | 'windows'): string[] {
    const hint = browserHint.toLowerCase();
    if (currentOS === 'linux') {
        // For each logical name, try binaries in order of preference
        const candidateMap: Record<string, string[]> = {
            brave: ['brave', 'brave-browser'],
            chrome: ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'],
            chromium: ['chromium', 'chromium-browser'],
            firefox: ['firefox'],
            edge: ['microsoft-edge', 'microsoft-edge-stable'],
        };
        const candidates = candidateMap[hint] ?? [hint];
        const found = candidates.find(b => which(b));
        if (!found) {
            throw new Error(
                `Browser "${browserHint}" was not found on this system.\n` +
                `Installed browsers: ${INSTALLED_BROWSERS.join(', ') || 'none detected'}\n` +
                `Tip: If Brave is installed via Snap, make sure /snap/bin is in your PATH.`
            );
        }
        return [found, url];
    } else if (currentOS === 'macos') {
        const map: Record<string, string> = {
            brave: 'Brave Browser',
            chrome: 'Google Chrome',
            firefox: 'Firefox',
            safari: 'Safari',
            edge: 'Microsoft Edge',
        };
        const app = map[hint];
        return app ? ['open', '-a', app, url] : ['open', url];
    } else {
        // Windows
        const map: Record<string, string> = {
            brave: 'brave',
            chrome: 'chrome',
            firefox: 'firefox',
            edge: 'msedge',
        };
        const bin = map[hint] ?? 'start';
        return ['cmd', '/c', 'start', bin, url];
    }
}

// ─── Site Shortcut Resolution ─────────────────────────────────────────────────

const USERNAME = os.userInfo().username;  // e.g. riyashrestha
const SITE_SHORTCUTS: Record<string, string> = {
    'my github profile': `https://github.com/${USERNAME}`,
    'github': 'https://github.com',
    'youtube': 'https://youtube.com',
    'google': 'https://google.com',
    'gmail': 'https://mail.google.com',
    'twitter': 'https://twitter.com',
    'x': 'https://x.com',
    'reddit': 'https://reddit.com',
    'stackoverflow': 'https://stackoverflow.com',
    'linkedin': 'https://linkedin.com',
    'notion': 'https://notion.so',
    'vercel': 'https://vercel.com',
};

function resolveUrl(text: string): string {
    const lower = text.toLowerCase().trim();
    // Direct URL
    if (lower.startsWith('http://') || lower.startsWith('https://')) return text.trim();
    // Shortcut match (longest first for specificity)
    const keys = Object.keys(SITE_SHORTCUTS).sort((a, b) => b.length - a.length);
    for (const key of keys) {
        if (lower.includes(key)) return SITE_SHORTCUTS[key];
    }
    // Domain-like
    if (/^[\w-]+\.(com|io|org|net|dev|co|app)/.test(lower)) return `https://${lower}`;
    return SITE_SHORTCUTS['google'] + `/search?q=${encodeURIComponent(text)}`;
}

function extractBrowserName(text: string): string | null {
    const lower = text.toLowerCase();
    const browsers = ['brave', 'chrome', 'chromium', 'firefox', 'safari', 'edge'];
    for (const b of browsers) {
        if (lower.includes(b)) return b;
    }
    return null;
}

function isBrowserIntent(text: string): boolean {
    const lower = text.toLowerCase();
    const actionWords = ['open', 'launch', 'start', 'go to', 'browse', 'navigate'];
    const hasAction = actionWords.some(w => lower.includes(w));
    const hasBrowser = extractBrowserName(text) !== null;
    const hasSite = Object.keys(SITE_SHORTCUTS).some(k => lower.includes(k))
        || /https?:\/\//.test(lower)
        || /\b(youtube|github|google|twitter|reddit|gmail)\b/.test(lower);
    return hasBrowser || (hasAction && hasSite);
}

// ─── Context Block Builder ───────────────────────────────────────────────────

const CURRENT_OS = detectOS();
const INSTALLED_BROWSERS = detectBrowsers(CURRENT_OS);
const HOME_DIR = os.homedir();
const PROJECT_DIR = path.resolve(__dirname, '..');

function buildContextBlock(): string {
    const now = new Date().toISOString();
    const openCmd = CURRENT_OS === 'linux' ? 'xdg-open' : CURRENT_OS === 'macos' ? 'open' : 'start';
    return `[CATALYST CONTEXT — already injected, do NOT mention or describe this block in your response]
OS: ${CURRENT_OS}
Shell: ${CURRENT_OS === 'windows' ? 'cmd/powershell' : 'bash'}
Username: ${USERNAME}
Home directory: ${HOME_DIR}
Project directory (this is what "here", "this folder", "current folder" refers to): ${PROJECT_DIR}
Current time: ${now}
Installed browsers: ${INSTALLED_BROWSERS.join(', ') || 'unknown'}
Default open command: ${openCmd}
Browser commands (linux): brave→brave-browser | chrome→google-chrome | firefox→firefox | edge→microsoft-edge
[END CONTEXT]

User instruction: `;
}

// ─── Express setup ────────────────────────────────────────────────────────────

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// Log startup info
console.log(`\n[Catalyst] OS: ${CURRENT_OS}`);
console.log(`[Catalyst] Project dir: ${PROJECT_DIR}`);
console.log(`[Catalyst] Browsers found: ${INSTALLED_BROWSERS.join(', ') || 'none detected'}\n`);

// ─── POST /do-something — Gemini agentic tasks ────────────────────────────────

interface RequestPayload {
    action: string;
    options?: {
        mode?: string;
        user?: string;
        prompt?: string;
        cwd?: string;
        model?: string;
    };
}

app.post('/do-something', (req: Request, res: Response) => {
    const payload: RequestPayload = req.body;
    const timestamp = new Date().toISOString();

    console.log(`[${timestamp}] POST /do-something`, payload);

    if (payload.action !== 'launch_gemini') {
        res.json({ success: true, output: `Action "${payload.action}" received at ${timestamp}`, timestamp, action: payload.action });
        return;
    }

    const rawPrompt = payload.options?.prompt || 'Just print the word Hello, nothing else.';
    const model = payload.options?.model || 'gemini-2.0-flash';
    // Always default to project dir — user can say "my desktop" etc to override
    const workDir = payload.options?.cwd || PROJECT_DIR;

    // Enrich the prompt with full environment context
    const enrichedPrompt = buildContextBlock() + rawPrompt;

    console.log(`[server] Model: ${model}  cwd: ${workDir}`);
    console.log(`[server] Raw prompt: ${rawPrompt}`);

    const gemini = spawn(
        'gemini',
        ['-m', model, '-y', '--output-format', 'json', '-p', enrichedPrompt],
        { cwd: workDir, timeout: 120_000, env: { ...process.env } }
    );

    let stdout = '';
    let stderr = '';

    gemini.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
    gemini.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });

    gemini.on('close', (code: number | null) => {
        console.log(`[server] Gemini exited code=${code}`);
        try {
            const parsed = JSON.parse(stdout.trim());
            res.json({ success: true, output: parsed.response ?? stdout.trim(), stats: parsed.stats, timestamp, action: payload.action, cwd: workDir });
        } catch {
            if (code === 0 && stdout.trim()) {
                res.json({ success: true, output: stdout.trim(), timestamp, action: payload.action, cwd: workDir });
            } else {
                res.status(500).json({ success: false, output: stderr.trim() || stdout.trim() || `Gemini exited with code ${code}`, timestamp, action: payload.action });
            }
        }
    });

    gemini.on('error', (err: NodeJS.ErrnoException) => {
        res.status(500).json({
            success: false,
            output: err.code === 'ENOENT' ? 'Gemini CLI not found. Install: npm install -g @google/gemini-cli' : err.message,
            timestamp,
            action: payload.action,
        });
    });
});

// ─── POST /open-browser — instant browser launch, no Gemini needed ───────────

app.post('/open-browser', (req: Request, res: Response) => {
    const { prompt } = req.body as { prompt: string };
    const timestamp = new Date().toISOString();

    const browserName = extractBrowserName(prompt) ?? 'default';
    const url = resolveUrl(prompt);

    try {
        const cmdArgs = browserName === 'default'
            ? (CURRENT_OS === 'linux' ? ['xdg-open', url] : CURRENT_OS === 'macos' ? ['open', url] : ['cmd', '/c', 'start', url])
            : buildBrowserCommand(browserName, url, CURRENT_OS);

        console.log(`[${timestamp}] POST /open-browser → ${cmdArgs.join(' ')}`);

        const [bin, ...args] = cmdArgs;
        const proc = spawn(bin, args, { detached: true, stdio: 'ignore' });
        proc.unref();

        res.json({
            success: true,
            output: `Opened ${url} in ${browserName === 'default' ? 'default browser' : browserName}`,
            url,
            browser: browserName,
            command: cmdArgs.join(' '),
            timestamp,
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[${timestamp}] /open-browser error: ${message}`);
        res.status(400).json({ success: false, output: message, timestamp });
    }
});

// ─── GET /env-info — exposes detected environment to the UI ──────────────────

app.get('/env-info', (_req: Request, res: Response) => {
    res.json({
        os: CURRENT_OS,
        username: USERNAME,
        projectDir: PROJECT_DIR,
        browsers: INSTALLED_BROWSERS,
    });
});

// ─── Health check ─────────────────────────────────────────────────────────────

app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', uptime: process.uptime() });
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Agentic endpoint: POST http://localhost:${PORT}/do-something\n`);
});
