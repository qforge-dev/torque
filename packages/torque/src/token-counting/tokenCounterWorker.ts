import { countTokensSync } from "./countTokens";
import type { TokenCountWorkerRequest } from "./types";

declare const self: {
  postMessage: (message: unknown) => void;
  onmessage: ((event: { data: TokenCountWorkerRequest }) => void) | null;
};

self.onmessage = (event) => {
  const { id, payload } = event.data;

  try {
    const result = countTokensSync(
      payload.messages,
      payload.tools,
      payload.model
    );
    self.postMessage({ id, result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to count tokens";
    self.postMessage({ id, error: message });
  }
};
