import type { ModelMessage } from "ai";

/**
 * Ensures all system messages are placed before other roles while preserving their
 * internal order. If no reordering is needed, the original array reference is returned.
 */
export function hoistSystemMessages<T extends ModelMessage>(
  messages: T[]
): T[] {
  let needsHoist = false;
  let hasSeenNonSystem = false;

  for (const message of messages) {
    if (message.role === "system") {
      if (hasSeenNonSystem) {
        needsHoist = true;
        break;
      }
    } else {
      hasSeenNonSystem = true;
    }
  }

  if (!needsHoist) {
    return messages;
  }

  const systemMessages: T[] = [];
  const otherMessages: T[] = [];

  for (const message of messages) {
    if (message.role === "system") {
      systemMessages.push(message);
    } else {
      otherMessages.push(message);
    }
  }

  return [...systemMessages, ...otherMessages];
}
