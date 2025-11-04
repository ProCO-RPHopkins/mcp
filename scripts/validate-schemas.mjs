//// scripts/validate-schemas.mjs
import Ajv from "ajv";
import addFormats from "ajv-formats";
// Correct deep imports
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { ListToolsResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { URL } from "node:url";

// Default to the /mcp (HTTP) endpoint
const MCP_URL = process.env.MCP_URL || "https://mcp.posthog.com/mcp";
const AUTH = process.env.POSTHOG_AUTH_HEADER;

if (!AUTH) {
	console.error("Error: Missing POSTHOG_AUTH_HEADER environment variable.");
	console.error(
		'Usage: POSTHOG_AUTH_HEADER="Bearer <phx_...>" node scripts/validate-schemas.mjs',
	);
	process.exit(1);
}

console.log('Auth check: Found header variable starting with: "${AUTH.substring(0, 10)}..."');
console.log("Connecting to ${MCP_URL} using StreamableHTTPClientTransport...");

// The 'headers' must be nested inside 'requestInit'
const transport = new StreamableHTTPClientTransport(new URL(MCP_URL), {
	requestInit: {
		headers: { Authorization: AUTH },
	},
	serverInfo: { name: "schema-validator", version: "0.0.1" },
});

const client = new Client({ name: "schema-validator", version: "0.0.1" });

try {
	await client.connect(transport);
	console.log("Connection successful.");
} catch (err) {
	console.error(`Failed to connect to MCP: ${err}`);
	if (err.cause) console.error(`Cause: ${err.cause}`);
	process.exit(1);
}

// --- AJV VALIDATION LOGIC ---
console.log("Fetching tool list...");

// We MUST pass the response schema as the second argument
const toolsResp = await client.request({ method: "tools/list" }, ListToolsResultSchema);

const tools = toolsResp.tools ?? [];

if (tools.length === 0) {
	console.warn("Warning: Fetched 0 tools. This is unexpected.");
}

const ajv = new Ajv({ allErrors: true, strict: true });
addFormats(ajv);

const results = [];

for (const tool of tools) {
	// <-- Fixed typo here
	if (!tool.inputSchema) {
		continue;
	}

	const { name, inputSchema } = tool;

	try {
		ajv.compile(inputSchema);
		results.push({
			tool: name,
			valid: true,
			errors: [],
		});
	} catch (err) {
		results.push({
			tool: name,
			valid: false,
			compileError: String(err),
			errors: err.errors ?? [],
		});
	}
}

const invalid = results.filter((r) => !r.valid);
console.log("---");
console.log("Tools fetched: ${tools.length}");
console.log("Invalid schemas: ${invalid.length}");
console.log("---");

for (const item of invalid) {
	console.log(`\nTool: ${item.tool}`);
	if (item.compileError) {
		console.log("AJV Compile Error:", item.compileError);
	}
	if (item.errors?.length) {
		console.log("Details:", JSON.stringify(item.errors, null, 2));
	}
}

// *** THIS IS THE FIX ***
// The method is client.close(), not disconnect()
await client.close();
console.log("\nClient disconnected gracefully.");
process.exit(0);
