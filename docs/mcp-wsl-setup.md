# MCP on VS Code (WSL/Ubuntu) - 15-min setup & troubleshooting

> Public contributor guide for running PostHog’s MCP tools reliably in **WSL/Ubuntu + VS Code**, generating baseline outputs, and avoiding common auth/schema pitfalls.

---

## Who is this for?

* Contributors using **WSL/Ubuntu** with **VS Code** who want a **repeatable** MCP setup.
* Useful when validating issues like schema errors (e.g., duplicate `enum` values) and when preparing PR baselines.

---

## Prerequisites

* **VS Code** with **Remote – WSL** enabled
* **WSL/Ubuntu** shell
* **Node.js ≥ 20** and **pnpm ≥ 9**
* A **PostHog Personal API Key** (`phx_…`) — *not* a project key (`phc_…`)

> Check versions:

```bash
node -v
pnpm -v
```

---

## A) One-time WSL/Ubuntu prep

1. Update corepack & pnpm:

```bash
corepack enable
corepack install -g pnpm@latest
```

2. Optional: ensure curl is present:

```bash
sudo apt-get update && sudo apt-get install -y curl
```

---

## B) VS Code workspace config (SSE via mcp-remote)

Create a workspace file so VS Code can start the MCP server for you.

1. In your repo/workspace root, create `.vscode/mcp.json`:

```json
{
  "servers": {
    "posthog-clean": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote@latest",
        "https://mcp.posthog.com/sse",
        "--header",
        "Authorization:${POSTHOG_AUTH_HEADER}"
      ],
      "env": {
        "POSTHOG_AUTH_HEADER": "Bearer phx_YOUR_PERSONAL_KEY_HERE"
      }
    }
  }
}
```

2. **Never commit secrets**. Add to `.gitignore`:

```
.vscode/mcp.json
```

> Pro tip (optional): add a **pre-commit** hook to block accidental token commits (`phx_`/`phc_`).

---

## C) Start & inspect in VS Code

1. **Reload window** (VS Code): `Ctrl+Shift+P` → **Developer: Reload Window**
2. **Start server**: `Ctrl+Shift+P` → **MCP: List Servers** → start **posthog-clean**
3. Open **Output** panel (`View → Output`). In the dropdown, choose **Model Context Protocol**.
   You should see:

   * “Connected to remote server using **SSE**”
   * “Discovered **N tools**”
   * If present: “**X tools have invalid JSON schemas and will be omitted**” (capture this line for baselines)

---

## D) (Optional) Create a synthetic error event (for error tooling smoke-tests)

> Use your **project** API key (`phc_…`) **only** for ingestion endpoints; your VS Code server auth continues to use `phx_…`.

```bash
export PH_PROJECT_API_KEY="phc_your_project_key_here"
curl -sL -H "Content-Type: application/json" \
  -d '{"api_key":"'"$PH_PROJECT_API_KEY"'",
       "event":"$exception",
       "distinct_id":"mcp-test",
       "properties":{"$exception_list":[{"type":"MCPTestError","value":"curl test throw"}]}}' \
  https://us.i.posthog.com/i/v0/e/
```

Then use MCP tools (e.g., `list-errors`) to confirm visibility and time-range handling.

---

## E) Common failure signatures - fixes

### 1) **“Discovered 0 tools”**

* Likely **bad/missing auth**.
* Fix: ensure `.vscode/mcp.json` uses your **`phx_`** personal key and the header is exactly `"Authorization: Bearer phx_…"` (normal space).

### 2) **“401 / No token provided”** (scripts)

* If using the **HTTP** client (`/mcp`) in Node scripts, headers must be in `requestInit.headers`.
* Example (pseudocode):
  `new StreamableHTTPClientTransport(url, { requestInit: { headers: { Authorization: "Bearer phx_…" }}})`

### 3) **ENOTFOUND / 404 first, then connects**

* `mcp-remote` tries HTTP then falls back to **SSE**; a 404 POST first is **normal**. The SSE connect is the success signal.

### 4) **Invalid JSON schema warnings**

* Expected if a tool’s input schema has issues (e.g., duplicate `enum` value). Capture the Output panel lines for your baseline.

---

## F) Optional: MCP Inspector (handy during dev)

You can directly inspect tool calls with the MCP Inspector:

```bash
npx @modelcontextprotocol/inspector npx -y mcp-remote@latest https://mcp.posthog.com/sse --header "Authorization: Bearer phx_YOUR_PERSONAL_KEY_HERE"
```

(Or use transport **STDIO** in the Inspector UI with equivalent args.)

---

## G) Baselines you should capture (for PR context)

Create a `reports/` folder in your repo and store short text summaries:

* **Tool discovery summary** (region & timestamp):

```
[Timestamp: 2025-11-02T13:23:16Z] VS Code + mcp-remote 0.1.29
Region: US/EU (connected via https://mcp.posthog.com/sse)
Discovered 43 tools
4–5 tools have invalid JSON schemas and will be omitted
# Snippet from Output (no secrets):
# [info] Discovered 43 tools
# [warning] X tools have invalid JSON schemas and will be omitted
```

* If you exercise error tools, note the **date ranges** and **empty vs non-empty** results.

---

## H) Security notes

* Keep **personal keys (`phx_`)** out of commits (`.gitignore` + pre-commit hook).
* When sharing screenshots/logs, **redact IPs and keys**.
* Prefer environment variables locally; for VS Code MCP, a **workspace-local** `.vscode/mcp.json` is fine if ignored.
