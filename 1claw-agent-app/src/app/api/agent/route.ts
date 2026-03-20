import { streamText, convertToModelMessages, type UIMessage } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { retrieveSecretTool } from "@/lib/agent-tools";
import { fetchSecret } from "@/lib/1claw";

export const runtime = "nodejs"; // Required — Edge runtime cannot use the 1claw SDK

const GEMINI_SECRET_PATH =
  process.env.ONECLAW_GEMINI_SECRET_PATH ?? "api-keys/gemini";

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  // Fetch Gemini API key from 1claw at runtime — never in env or build
  const geminiApiKey = await fetchSecret(GEMINI_SECRET_PATH);
  const google = createGoogleGenerativeAI({ apiKey: geminiApiKey });

  const result = await streamText({
    model: google("gemini-2.0-flash"),
    system: `You are a helpful AI agent with access to a 1claw HSM-backed secret vault.
When a user asks you to retrieve a secret or perform a task that requires credentials,
use the retrieve_secret tool to fetch the value at runtime.
Never ask the user to paste credentials into the chat — always retrieve them from the vault.
After retrieving a secret, confirm what was fetched (by path) without revealing the full value.`,
    messages: await convertToModelMessages(messages),
    tools: {
      retrieve_secret: retrieveSecretTool,
    },
  });

  return result.toUIMessageStreamResponse();
}
