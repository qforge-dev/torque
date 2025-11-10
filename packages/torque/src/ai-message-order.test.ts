import { describe, expect, it } from "bun:test";
import type { ModelMessage } from "ai";
import { hoistSystemMessages } from "./ai-message-order";

const message = (role: ModelMessage["role"], content: string): ModelMessage => ({
  role,
  content,
});

describe("hoistSystemMessages", () => {
  it("returns the same order when system messages already lead", () => {
    const messages = [
      message("system", "s1"),
      message("system", "s2"),
      message("user", "u1"),
    ];

    const result = hoistSystemMessages(messages);

    expect(result).toEqual(messages);
  });

  it("moves trailing system messages ahead of other roles", () => {
    const messages = [
      message("user", "u1"),
      message("system", "s1"),
      message("assistant", "a1"),
      message("system", "s2"),
      message("user", "u2"),
    ];

    const result = hoistSystemMessages(messages);

    expect(result.map((m) => m.content)).toEqual(["s1", "s2", "u1", "a1", "u2"]);
  });

  it("preserves the relative order among system and non-system messages", () => {
    const messages = [
      message("assistant", "a1"),
      message("user", "u1"),
      message("system", "s1"),
      message("user", "u2"),
      message("system", "s2"),
      message("assistant", "a2"),
    ];

    const result = hoistSystemMessages(messages);

    expect(result.map((m) => m.content)).toEqual([
      "s1",
      "s2",
      "a1",
      "u1",
      "u2",
      "a2",
    ]);
  });

  it("leaves arrays without system messages untouched", () => {
    const messages = [
      message("user", "u1"),
      message("assistant", "a1"),
      message("user", "u2"),
    ];

    const result = hoistSystemMessages(messages);

    expect(result).toEqual(messages);
  });
});
