import express, { Request, Response } from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
import path from 'path';
import os from 'os';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

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

// POST /do-something
// Spawns Gemini CLI in YOLO agentic mode, waits for completion, returns JSON.
app.post('/do-something', (req: Request, res: Response) => {
    const payload: RequestPayload = req.body;
    const timestamp = new Date().toISOString();

    console.log(`[${timestamp}] POST /do-something`, payload);

    if (payload.action !== 'launch_gemini') {
        res.json({
            success: true,
            output: `Action "${payload.action}" received at ${timestamp}`,
            timestamp,
            action: payload.action,
        });
        return;
    }

    const userPrompt = payload.options?.prompt || 'Just print the word Hello, nothing else.';
    const model = payload.options?.model || 'gemini-2.0-flash';
    // Run in the user's home dir by default so Gemini can see & create files there
    const workDir = payload.options?.cwd || os.homedir();

    console.log(`[server] Launching Gemini  model=${model}  cwd=${workDir}`);
    console.log(`[server] Prompt: ${userPrompt}`);

    // -y / --yolo  → auto-approve ALL tool calls (file create/edit, shell, etc.)
    // --output-format json  → single JSON blob with { response, stats }
    const gemini = spawn(
        'gemini',
        [
            '-m', model,
            '-y',                          // YOLO: no approval prompts
            '--output-format', 'json',
            '-p', userPrompt,
        ],
        {
            cwd: workDir,
            timeout: 120_000,              // 2 min — agentic tasks take time
            env: { ...process.env },
        }
    );

    let stdout = '';
    let stderr = '';

    gemini.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
    gemini.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });

    gemini.on('close', (code: number | null) => {
        console.log(`[server] Gemini exited  code=${code}`);

        // Try to parse the structured JSON response
        try {
            const parsed = JSON.parse(stdout.trim());
            res.json({
                success: true,
                output: parsed.response ?? stdout.trim(),
                stats: parsed.stats,
                timestamp,
                action: payload.action,
                cwd: workDir,
            });
        } catch {
            // Plain text output (no JSON) — still a success if exit code is 0
            if (code === 0 && stdout.trim()) {
                res.json({
                    success: true,
                    output: stdout.trim(),
                    timestamp,
                    action: payload.action,
                    cwd: workDir,
                });
            } else {
                res.status(500).json({
                    success: false,
                    output: stderr.trim() || stdout.trim() || `Gemini exited with code ${code}`,
                    timestamp,
                    action: payload.action,
                });
            }
        }
    });

    gemini.on('error', (err: NodeJS.ErrnoException) => {
        res.status(500).json({
            success: false,
            output:
                err.code === 'ENOENT'
                    ? 'Gemini CLI not found. Install: npm install -g @google/gemini-cli'
                    : err.message,
            timestamp,
            action: payload.action,
        });
    });
});

// Health check
app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', uptime: process.uptime() });
});

app.listen(PORT, () => {
    console.log(`\n🚀 Server running at http://localhost:${PORT}`);
    console.log(`🤖 Agentic endpoint: POST http://localhost:${PORT}/do-something\n`);
});
