# ✨ Catalyst

> A UI-driven agentic launcher that sends natural language instructions to Gemini CLI, which then acts on your computer to complete them — in real time.

---

## 📖 What is Catalyst?

Catalyst is a lightweight full-stack application that bridges a clean browser UI with the **Gemini CLI** running in agentic (YOLO) mode. You type an instruction in plain English, pick a Gemini model, hit **Launch Catalyst**, and Gemini executes the task directly on your machine — creating files, running commands, searching the web, and more.

The architecture is intentionally minimal:

```
Browser UI  →  POST /do-something  →  Express Server  →  Gemini CLI (--yolo)  →  JSON Response
```

---

## Features

- **Natural language task execution** — describe anything and Gemini does it
- **Model selector** — choose from 7 Gemini model variants across three generations
- **Agentic YOLO mode** — Gemini auto-approves all tool calls (file create/edit, shell, web search, etc.) with no approval prompts
- **Dark / Light mode toggle** — theme preference persisted in `localStorage`
- **Live response panel** — shows Gemini's output with a success/error status and timestamp
- **Trigger.dev integration** — scaffolded for background task processing via Trigger.dev SDK

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Vanilla HTML, CSS, JavaScript |
| **Fonts** | Inter (UI) + Fira Code (monospace) via Google Fonts |
| **Backend** | Node.js + Express (TypeScript) |
| **AI** | [Gemini CLI](https://github.com/google-gemini/gemini-cli) (`@google/gemini-cli`) |
| **Background Tasks** | [Trigger.dev](https://trigger.dev) SDK v4 |
| **Language** | TypeScript 5 |
| **Runtime Compiler** | ts-node |

---

## Project Structure

```
.
├── public/
│   └── index.html          # Single-page UI (Catalyst frontend)
├── src/
│   ├── server.ts           # Express server + Gemini CLI spawn logic
│   └── trigger/
│       └── example.ts      # Example Trigger.dev background task
├── trigger.config.ts       # Trigger.dev project configuration
├── tsconfig.json           # TypeScript compiler options
├── package.json
└── README.md
```

---

## Supported Gemini Models

The model selector offers the following options, grouped by generation:

| Generation | Model | Notes |
|---|---|---|
| Gemini 2.5 | `gemini-2.5-pro-preview-03-25` | Most capable |
| Gemini 2.0 | `gemini-2.0-flash` *(default)* | Fast & smart |
| Gemini 2.0 | `gemini-2.0-flash-lite` | Lightest / cheapest |
| Gemini 2.0 | `gemini-2.0-pro-exp` | Experimental |
| Gemini 1.5 | `gemini-1.5-pro` | Long context (1M tokens) |
| Gemini 1.5 | `gemini-1.5-flash` | Efficient |
| Gemini 1.5 | `gemini-1.5-flash-8b` | Compact |

---

## Prerequisites

1. **Node.js** ≥ 18
2. **Gemini CLI** installed and authenticated globally:
   ```bash
   npm install -g @google/gemini-cli
   gemini auth          # follow OAuth flow
   ```
3. A **Google account** with Gemini API access

---

## Getting Started

```bash
# 1. Clone / enter the project
cd "Button triggred api endpoint"

# 2. Install dependencies
npm install

# 3. Start the dev server
npm run dev
```

Open **http://localhost:3001** in your browser.

### Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start server with ts-node (hot-restarts on change) |
| `npm run build` | Compile TypeScript → `dist/` |
| `npm start` | Run the compiled production build |

---

## 🔌 API Reference

### `POST /do-something`

Triggers a Gemini CLI invocation.

**Request body:**
```json
{
  "action": "launch_gemini",
  "options": {
    "prompt": "Create a folder called test on my Desktop",
    "model": "gemini-2.0-flash",
    "mode": "default",
    "user": "riya",
    "cwd": "/home/riya"
  }
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `action` | `string` | ✅ | Must be `"launch_gemini"` to invoke Gemini |
| `options.prompt` | `string` | ✅ | The natural language instruction |
| `options.model` | `string` | ❌ | Gemini model ID (default: `gemini-2.0-flash`) |
| `options.cwd` | `string` | ❌ | Working directory (default: user home) |

**Success response:**
```json
{
  "success": true,
  "output": "Done! I created the folder...",
  "timestamp": "2026-02-19T15:30:00.000Z",
  "action": "launch_gemini",
  "cwd": "/home/riya"
}
```

**Error response:**
```json
{
  "success": false,
  "output": "Error message describing what went wrong",
  "timestamp": "2026-02-19T15:30:00.000Z"
}
```

### `GET /health`

Returns server uptime.

```json
{ "status": "ok", "uptime": 42.3 }
```

---

## YOLO Mode — What It Means

Gemini is launched with the `-y` / `--yolo` flag. This means:

- **All tool calls are auto-approved** — Gemini can create, edit, or delete files; run shell commands; browse the web; and more, all without asking for confirmation.
- Use descriptive, specific prompts to avoid unintended actions.
- Gemini runs with a **2-minute timeout**. Long agentic tasks may need the timeout increased in `src/server.ts`.

---

## Trigger.dev Integration

The project includes a scaffold for [Trigger.dev](https://trigger.dev) background tasks. The example task lives at `src/trigger/example.ts`:

```ts
export const helloWorldTask = task({
  id: "hello-world",
  maxDuration: 300,
  run: async (payload, { ctx }) => {
    // Background task logic here
    return { message: "Hello, world!" + payload.name };
  },
});
```

Configure your Trigger.dev project in `trigger.config.ts` and run `npx trigger.dev dev` to connect.

---

## UI Theming

The UI ships with two themes toggled by the button in the top-right corner:

| Theme | Trigger | Persisted |
|---|---|---|
| 🌙 Dark | Default | Yes (`localStorage`) |
| ☀️ Light | Click toggle | Yes (`localStorage`) |

Theme preference survives page reloads.

---

## License

MIT — do whatever you want with it.
