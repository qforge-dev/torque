import { encoding_for_model } from "tiktoken";
import type {
  IDatasetMessage,
  IDatasetTool,
} from "../types";
import type { TokenCountResult } from "./types";

export function countTokensSync(
  messages: IDatasetMessage[],
  tools: IDatasetTool[],
  model: string = "gpt-5"
): TokenCountResult {
  const encoding = encoding_for_model(model as any);

  let messageTokens = 0;
  let toolTokens = 0;

  try {
    for (const message of messages) {
      messageTokens += encoding.encode(JSON.stringify(message)).length;
    }

    for (const tool of tools) {
      toolTokens += encoding.encode(JSON.stringify(tool)).length;
    }
  } finally {
    encoding.free();
  }

  return {
    messages: messageTokens,
    tools: toolTokens,
    total: messageTokens + toolTokens,
  };
}
