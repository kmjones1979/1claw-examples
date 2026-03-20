import { tool, zodSchema } from "ai";
import { z } from "zod";
import { fetchSecret } from "./1claw";

/**
 * Tool that lets the AI agent retrieve a named secret from 1claw at runtime.
 * The secret is fetched server-side, used in the response, and never persisted.
 */
export const retrieveSecretTool = tool({
  description:
    "Retrieve a secret value from the 1claw HSM vault by its path. " +
    "Use this when you need an API key, token, or credential to complete a task. " +
    "Secrets are fetched at runtime and are never stored in context or logs.",
  inputSchema: zodSchema(
    z.object({
      secret_path: z
        .string()
        .describe(
          "The vault path of the secret, e.g. 'api-keys/openai' or 'tokens/github'"
        ),
    })
  ),
  execute: async ({ secret_path }: { secret_path: string }) => {
    try {
      const value = await fetchSecret(secret_path);
      return {
        success: true,
        secret_path,
        // Return a masked preview so the agent knows retrieval worked
        // without the full value appearing in the conversation log
        preview: `${value.slice(0, 6)}...${value.slice(-4)}`,
        message: `Secret retrieved successfully from path: ${secret_path}`,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, secret_path, error: message };
    }
  },
});
