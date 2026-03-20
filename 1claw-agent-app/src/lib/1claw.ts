import { createClient } from "@1claw/sdk";

const BASE_URL = process.env.ONECLAW_BASE_URL ?? "https://api.1claw.xyz";

// Singleton client — SDK handles JWT exchange and auto-refresh internally
let _client: ReturnType<typeof createClient> | null = null;
let _authPromise: Promise<void> | null = null;

async function ensureAuthenticated() {
  if (!_client) {
    _client = createClient({ baseUrl: BASE_URL });

    const agentId = process.env.ONECLAW_AGENT_ID?.trim();
    const agentApiKey = process.env.ONECLAW_AGENT_API_KEY?.trim();
    const userApiKey = process.env.ONECLAW_API_KEY?.trim();

    if (agentId && agentApiKey) {
      const authRes = await _client.auth.agentToken({
        api_key: agentApiKey,
        agent_id: agentId,
      });
      if (authRes.error) {
        throw new Error(`1claw agent auth failed: ${authRes.error.message}`);
      }
    } else if (userApiKey) {
      const authRes = await _client.auth.apiKeyToken({ api_key: userApiKey });
      if (authRes.error) {
        throw new Error(`1claw auth failed: ${authRes.error.message}`);
      }
    } else {
      const missing = [];
      if (!agentId && !userApiKey) missing.push("ONECLAW_AGENT_ID or ONECLAW_API_KEY");
      if (agentApiKey && !agentId) missing.push("ONECLAW_AGENT_ID (you have ONECLAW_AGENT_API_KEY set)");
      if (!agentApiKey && !userApiKey) missing.push("ONECLAW_AGENT_API_KEY or ONECLAW_API_KEY");
      
      throw new Error(
        `Missing required 1claw credentials in .env.local. ` +
        `Set either:\n` +
        `  - ONECLAW_AGENT_ID + ONECLAW_AGENT_API_KEY (for agent auth), or\n` +
        `  - ONECLAW_API_KEY (for user auth)\n` +
        `Missing: ${missing.join(", ")}\n` +
        `Run 'npm run setup' to generate agent credentials automatically.`
      );
    }
  }
}

export async function get1ClawClient() {
  if (!_authPromise) {
    _authPromise = ensureAuthenticated();
  }
  await _authPromise;
  return _client!;
}

/**
 * Fetch a secret value from the 1claw vault at runtime.
 * The secret value is used immediately and never stored or logged.
 */
export async function fetchSecret(path: string): Promise<string> {
  const client = await get1ClawClient();
  const vaultId = process.env.ONECLAW_VAULT_ID!;
  const { data, error } = await client.secrets.get(vaultId, path);
  if (error || !data) {
    throw new Error(
      error?.message ?? `Failed to fetch secret at path: ${path}`
    );
  }
  return data.value as string;
}
