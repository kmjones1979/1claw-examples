/**
 * One-time setup using ONECLAW_API_KEY:
 * 1. Create or use existing vault
 * 2. Create an agent and grant it vault read access
 * 3. Store GEMINI_API_KEY in the vault at api-keys/gemini
 * 4. Append ONECLAW_AGENT_ID and ONECLAW_AGENT_API_KEY to .env.local
 *
 * Run: npm run setup
 * Prereq: Set ONECLAW_API_KEY and optionally GEMINI_API_KEY in .env.local
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@1claw/sdk";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const envPath = join(process.cwd(), ".env.local");
const BASE_URL = process.env.ONECLAW_BASE_URL ?? "https://api.1claw.xyz";

async function main() {
  const apiKey = (process.env.ONECLAW_API_KEY ?? "").trim();
  const vaultId = (process.env.ONECLAW_VAULT_ID ?? "").trim();
  const geminiKey = (process.env.GEMINI_API_KEY ?? "").trim();

  if (!apiKey || apiKey.startsWith("<") || apiKey.includes("your-")) {
    console.error("Set ONECLAW_API_KEY in .env.local (from https://1claw.xyz/settings/api-keys)");
    console.error("Then run: npm run setup");
    process.exit(1);
  }

  const client = createClient({ baseUrl: BASE_URL });
  const authRes = await client.auth.apiKeyToken({ api_key: apiKey });
  if (authRes.error) {
    console.error("Auth failed:", authRes.error.message);
    process.exit(1);
  }

  let vault: { id: string; name: string };

  if (vaultId) {
    const listRes = await client.vault.list();
    const existing = listRes.data?.vaults?.find((v) => v.id === vaultId);
    if (existing) {
      vault = existing;
      console.log("Using existing vault:", vault.name, "(" + vault.id + ")");
    } else {
      console.error("ONECLAW_VAULT_ID set but vault not found.");
      process.exit(1);
    }
  } else {
    const vaultRes = await client.vault.create({
      name: "1claw-agent-app",
      description: "Vault for 1claw Next.js agent (secrets + Gemini API key)",
    });
    if (vaultRes.error) {
      const listRes = await client.vault.list();
      const first = listRes.data?.vaults?.[0];
      if (first) {
        vault = first;
        console.log("Using first existing vault:", vault.name, "(" + vault.id + ")");
      } else {
        console.error("Failed to create vault:", vaultRes.error.message);
        process.exit(1);
      }
    } else {
      vault = vaultRes.data!;
      console.log("Created vault:", vault.name, "(" + vault.id + ")");
    }
  }

  const agentRes = await client.agents.create({
    name: "1claw-agent-app",
    description: "Agent for 1claw Next.js app — vault read for secrets and Gemini key",
    auth_method: "api_key",
    scopes: ["vault.read"],
  });

  if (agentRes.error || !agentRes.data) {
    console.error("Create agent failed:", agentRes.error?.message ?? "no data");
    process.exit(1);
  }

  const { agent, api_key: agentApiKey } = agentRes.data;
  if (!agentApiKey) {
    console.error("Agent created but no API key returned.");
    process.exit(1);
  }

  const grantRes = await client.access.grantAgent(
    vault.id,
    agent.id,
    ["read"],
    { secretPathPattern: "**" }
  );
  if (grantRes.error) {
    console.error("Grant agent access failed:", grantRes.error.message);
  } else {
    console.log("Granted agent read access to vault (path pattern: **)");
  }

  if (geminiKey) {
    const setRes = await client.secrets.set(
      vault.id,
      "api-keys/gemini",
      geminiKey,
      { type: "api_key", metadata: { provider: "gemini" } }
    );
    if (setRes.error) {
      console.error("Store Gemini key in vault failed:", setRes.error.message);
    } else {
      console.log("Stored Gemini API key at api-keys/gemini");
    }
  } else {
    console.log("GEMINI_API_KEY not set — add it to .env.local and run setup again, or store it later in the vault at api-keys/gemini");
  }

  let envContent = existsSync(envPath) ? readFileSync(envPath, "utf-8") : "";
  const updates: string[] = [];
  if (envContent.includes("ONECLAW_AGENT_ID=")) {
    envContent = envContent.replace(/ONECLAW_AGENT_ID=.*/m, `ONECLAW_AGENT_ID=${agent.id}`);
  } else {
    updates.push(`ONECLAW_AGENT_ID=${agent.id}`);
  }
  if (envContent.includes("ONECLAW_AGENT_API_KEY=")) {
    envContent = envContent.replace(/ONECLAW_AGENT_API_KEY=.*/m, `ONECLAW_AGENT_API_KEY=${agentApiKey}`);
  } else {
    updates.push(`ONECLAW_AGENT_API_KEY=${agentApiKey}`);
  }
  if (!envContent.includes("ONECLAW_VAULT_ID=") || envContent.match(/ONECLAW_VAULT_ID=<?\s*$/m)) {
    if (envContent.includes("ONECLAW_VAULT_ID=")) {
      envContent = envContent.replace(/ONECLAW_VAULT_ID=.*/m, `ONECLAW_VAULT_ID=${vault.id}`);
    } else {
      updates.push(`ONECLAW_VAULT_ID=${vault.id}`);
    }
  }
  if (updates.length) {
    envContent = envContent.trimEnd() + "\n" + updates.join("\n") + "\n";
  }
  writeFileSync(envPath, envContent, "utf-8");

  console.log("\nUpdated .env.local with ONECLAW_AGENT_ID, ONECLAW_AGENT_API_KEY, and ONECLAW_VAULT_ID.");
  console.log("Run: npm run dev");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
