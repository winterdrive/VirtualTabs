/**
 * VirtualTabs MCP Server entry point
 *
 * Responsibilities:
 * - Parse optional command-line arguments
 * - Persist workspace path across sessions (~/.virtualtabs-mcp-state.json)
 * - Initialise VirtualTabsMCPServer (supports MCP Roots protocol)
 * - Create the stdio transport and connect
 *
 * NOTE: All logging in this file uses console.error() intentionally — the MCP
 * protocol reserves stdout exclusively for JSON-RPC messages; stderr is the
 * correct channel for human-readable log output.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { VirtualTabsMCPServer } from './server.js';

/** State file stored at ~/.virtualtabs-mcp-state.json */
const STATE_FILE = path.join(os.homedir(), '.virtualtabs-mcp-state.json');

interface McpState {
  lastWorkspaceRoot?: string;
}

function loadState(): McpState {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const raw = fs.readFileSync(STATE_FILE, 'utf-8');
      return JSON.parse(raw) as McpState;
    }
  } catch {
    // Ignore read errors; treat as empty state
  }
  return {};
}

function saveState(state: McpState): void {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch {
    // Ignore write errors (non-critical for core functionality)
  }
}

/**
 * Parse optional command-line arguments.
 */
function parseArgs(): { workspaceRoot?: string } {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    return { workspaceRoot: undefined };
  }

  let workspaceRoot: string | undefined;

  for (const arg of args) {
    if (arg.startsWith('--workspace-root=')) {
      workspaceRoot = arg.slice('--workspace-root='.length);
      break;
    }
    if (arg === '--workspace-root') {
      const idx = args.indexOf(arg);
      if (idx !== -1 && idx < args.length - 1) {
        workspaceRoot = args[idx + 1];
        break;
      }
    }
  }

  if (!workspaceRoot && args.length > 0 && !args[0].startsWith('-')) {
    workspaceRoot = args[0];
  }

  return { workspaceRoot };
}

/**
 * Validate that a workspace path exists and is a directory.
 */
function validateWorkspaceRoot(workspaceRoot: string): boolean {
  try {
    if (!fs.existsSync(workspaceRoot)) {
      console.error(`[WARNING] Workspace path does not exist: ${workspaceRoot}`);
      return false;
    }
    const stats = fs.statSync(workspaceRoot);
    if (!stats.isDirectory()) {
      console.error(`[WARNING] Workspace path is not a directory: ${workspaceRoot}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error(`[WARNING] Failed to validate workspace path: ${error}`);
    return false;
  }
}

/**
 * Main entry point.
 */
async function main() {
  try {
    // 1. Parse command-line arguments
    const { workspaceRoot: cliRoot } = parseArgs();

    // 2. Load cached state
    const state = loadState();

    // 3. Determine initial workspace root (priority: CLI arg > cache)
    let validatedWorkspaceRoot: string | undefined;

    if (cliRoot && validateWorkspaceRoot(cliRoot)) {
      validatedWorkspaceRoot = path.resolve(cliRoot);
      console.error(`[INFO] Using command-line workspace: ${validatedWorkspaceRoot}`);
    } else if (state.lastWorkspaceRoot && validateWorkspaceRoot(state.lastWorkspaceRoot)) {
      validatedWorkspaceRoot = state.lastWorkspaceRoot;
      console.error(`[INFO] Using cached workspace path: ${validatedWorkspaceRoot}`);
    }

    // 4. Create the VirtualTabs MCP Server
    const server = new VirtualTabsMCPServer(validatedWorkspaceRoot);

    // 5. Persist workspace root once the Roots protocol handshake completes.
    // Handshake timing varies by client, so poll periodically for up to 30 s
    // instead of checking only once after a fixed delay, which could miss
    // slower clients and silently skip caching for that session.
    let pollAttempts = 0;
    const MAX_POLL_ATTEMPTS = 30;
    const pollHandle = setInterval(() => {
      pollAttempts += 1;
      const root = server.getWorkspaceRoot();
      if (root) {
        saveState({ lastWorkspaceRoot: root });
        console.error(`[INFO] Workspace path cached: ${root}`);
        clearInterval(pollHandle);
      } else if (pollAttempts >= MAX_POLL_ATTEMPTS) {
        clearInterval(pollHandle);
      }
    }, 1000);

    // 6. Create the stdio transport and connect
    const transport = new StdioServerTransport();
    await server.connect(transport);

    console.error('[INFO] VirtualTabs MCP Server started successfully');
    if (!validatedWorkspaceRoot) {
      console.error('[INFO] Waiting for client to supply workspace path via MCP Roots protocol...');
    }
  } catch (error) {
    console.error('[ERROR] Server startup failed:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('[ERROR] Unexpected error:', error);
  process.exit(1);
});
