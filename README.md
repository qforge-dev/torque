# Torque

> Like React, but for datasets

**Torque** is a declarative, typesafe DSL for building complex LLM training datasets. Compose conversations like components, generate realistic variations with AI, and scale to thousands of examples with concurrent execution.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

## ✨ Features

- **🎯 Declarative DSL** - Compose conversations like React components
- **🔒 Fully Typesafe** - Zod schemas with complete type inference
- **🔌 Provider Agnostic** - Works with any AI SDK provider (OpenAI, Anthropic, DeepSeek, etc.)
- **⚡ Concurrent Generation** - Beautiful CLI with real-time progress tracking
- **🤖 AI-Powered Content** - Generate realistic variations automatically
- **♻️ Reusable Patterns** - Build libraries of conversation templates
- **💰 Cache Optimized (WIP)** - Reuses context across generations to reduce costs
- **📉 Cost Efficient** - Concise, optimized structures and generation workflow lets you use smaller, cheaper models

## 🚀 Quick Example

```typescript
import { generateDataset, generatedUser, assistant } from "@qforge/torque";
import { openai } from "@ai-sdk/openai";

await generateDataset(
  () => [
    generatedUser({ prompt: "Friendly greeting or introduction" }), // AI generated
    oneOf([
      // pick one randomly
      assistant({ content: "Hello!" }), // static
      generatedAssistant({ prompt: "Respond to greeting" }), // AI generated
    ]),
  ],
  {
    count: 2, // number of examples
    model: openai("gpt-5-mini"), // any ai-sdk model
    seed: 42, // replayable RNG
  }
);
```

Outputs:

```json
{"messages":[{"role":"user","content":[{"type":"text","text":"Hi there! I'm new here and just wanted to say hello."}]},{"role":"assistant","content":[{"type":"text","text":"Hello!"}]}]}

{"messages":[{"role":"user","content":[{"type":"text","text":"Hey! Hope you're having a great day."}]},{"role":"assistant","content":[{"type":"text","text":"Hey there! Thanks for reaching out. I'm doing great, how can I assist you today?"}]}]}
```

Notice how each user message is uniquely generated while the assistant response stays consistent!

## 🤔 Why Torque?

Building training datasets for LLMs is tedious:

- Manual conversation writing doesn't scale
- Maintaining consistency across thousands of examples is error-prone
- Tool calling patterns require intricate message sequences
- Testing different conversation flows means rewriting everything
- Writing generators that are both **random and deterministic** is surprisingly complex
- Getting AI to understand complex composition scenarios (nested variations, conditional flows) takes significant prompt engineering time

**Torque solves this** with a declarative approach. Just like React transformed UI development from imperative DOM manipulation to composable components, Torque transforms dataset generation from manual JSON editing or writing complicated scripts to declarative conversation schemas. Plus, its optimized structure means you can use smaller, cheaper models while benefiting from cache optimization for lower costs.

## 📦 Installation

```bash
bun add @qforge/torque
# or
npm install @qforge/torque
```

## 📚 Core Concepts

### Message Schemas

Build conversations by composing message schemas:

```typescript
import { user, assistant, system } from "@qforge/torque";

const schema = () => [
  system({ content: "You are a helpful assistant." }),
  user({ content: "Hello!" }),
  assistant({ content: "Hi! How can I help?" }),
];
```

### Composition Utilities

Build dynamic, varied datasets with composition helpers:

```typescript
import { oneOf, times, between, optional } from "@qforge/torque";

const schema = () => [
  // Choose randomly from options
  oneOf([
    user({ content: "Hello" }),
    user({ content: "Hi there" }),
    user({ content: "Hey" }),
  ])(),

  // Repeat pattern 3 times
  ...times(3, [
    generatedUser({ prompt: "Ask a question" }),
    generatedAssistant({ prompt: "Answer the question" }),
  ]),

  // Repeat random number of times (1-5)
  ...times(between(1, 5), [generatedUser({ prompt: "Follow-up question" })]),

  // Optionally include (50% chance)
  optional(assistant({ content: "Anything else I can help with?" })),
];
```

### AI-Generated Messages

Use prompts to generate realistic variations:

```typescript
import { generatedUser, generatedAssistant } from "@qforge/torque";

const schema = () => [
  generatedUser({
    prompt: "User greeting, casual and friendly",
  }),
  generatedAssistant({
    prompt: "Assistant responds warmly and offers help",
  }),
];
```

### Tool Definitions

Define tools with Zod schemas for complete type safety:

```typescript
import {
  tool,
  generatedToolCall,
  generatedToolCallResult,
} from "@qforge/torque";
import { z } from "zod";

const weatherTool = tool({
  name: "get_weather",
  description: "Get current weather for a location",
  parameters: z.object({
    location: z.string().describe("City name"),
    units: z.enum(["celsius", "fahrenheit"]).optional(),
  }),
  output: z.object({
    temperature: z.number(),
    condition: z.string(),
  }),
});

const schema = () => [
  weatherTool.toolFunction(),
  generatedUser({ prompt: "Ask about weather in a city" }),
  generatedToolCall(weatherTool, "t1"),
  generatedToolCallResult(weatherTool, "t1"),
  generatedAssistant({ prompt: "Interpret the weather data for the user" }),
];
```

### Two-Phase Execution

Torque executes in two phases:

1. **Check Phase** - Analyzes conversation structure, registers tools
2. **Generate Phase** - Creates actual content with AI generation

This enables:

- Accurate progress tracking
- Pre-validation of conversation flow
- Efficient token counting

### Reproducible Generation with Seeds

Control randomness for reproducible datasets:

```typescript
await generateDataset(schema, {
  count: 50,
  model: openai("gpt-4"),
  output: "data/dataset.jsonl",
  seed: 12345, // Same seed = same output
});
```

**How seeds work:**

- The `seed` parameter ensures deterministic generation across runs
- Same seed + same schema = identical dataset structure everytime
- Useful for debugging, testing, and versioning datasets
- If omitted, a random seed is generated and displayed in the CLI
- Seeds control both `torque` random selections and AI model sampling (when supported by the provider)

## 🔧 Advanced Examples

### Async Tool Pattern

Model conversations where tools take time to execute:

```typescript
import {
  generateDataset,
  generatedUser,
  generatedAssistant,
  generatedToolCall,
  generatedToolCallResult,
  tool,
  times,
  between,
} from "@qforge/torque";
import { z } from "zod";

const searchTool = tool({
  name: "web_search",
  description: "Search the web",
  parameters: z.object({ query: z.string() }),
  output: z.object({ results: z.array(z.string()) }),
});

await generateDataset(
  () => [
    searchTool.toolFunction(),

    // Initial request
    generatedUser({ prompt: "Ask for information requiring web search" }),

    // Tool call
    generatedToolCall(searchTool, "search-1"),

    // Immediate acknowledgment
    generatedToolCallResult(searchTool, "search-1", "<tool_ack />"),
    generatedAssistant({
      prompt: "Acknowledge search started, assure user it's in progress",
    }),

    // Filler conversation while waiting
    ...times(between(1, 3), [
      generatedUser({ prompt: "Casual conversation, unrelated to search" }),
      generatedAssistant({ prompt: "Respond naturally to casual topic" }),
    ]),

    // Actual result arrives
    generatedToolCall(searchTool, "search-1-FINAL", {
      reuseArgsFrom: "search-1",
    }),
    generatedToolCallResult(searchTool, "search-1-FINAL"),
    generatedAssistant({ prompt: "Present search results to user" }),
  ],
  {
    count: 50,
    model: openai("gpt-4"),
    output: "data/async-tools.jsonl",
  }
);
```

### Custom Generation Context

Guide the AI's generation style globally:

```typescript
await generateDataset(schema, {
  count: 100,
  model: openai("gpt-4"),
  output: "data/dataset.jsonl",
  generationContext: {
    global: {
      messages: [
        {
          role: "system",
          content:
            'Keep messages concise and natural. Avoid starting with "Sure" or "Thanks".',
        },
      ],
    },
    user: {
      messages: [
        {
          role: "system",
          content:
            "Generate diverse user messages with varying levels of technical detail.",
        },
      ],
    },
    assistant: {
      messages: [
        {
          role: "system",
          content:
            "Assistant should be helpful but concise. Use 2-3 sentences max.",
        },
      ],
    },
  },
});
```

### Multiple Tool Variations

Generate datasets with different tools:

```typescript
import { oneOf } from "@qforge/torque";

const tools = [weatherTool, calculatorTool, searchTool];

await generateDataset(
  () => {
    const tool = oneOf(tools)();

    return [
      tool.toolFunction(),
      generatedUser({ prompt: "Ask question requiring this tool" }),
      generatedToolCall(tool, "t1"),
      generatedToolCallResult(tool, "t1"),
      generatedAssistant({ prompt: "Present the result" }),
    ];
  },
  {
    count: 300, // 100 examples per tool
    model: openai("gpt-4"),
    output: "data/multi-tool.jsonl",
  }
);
```

## 📖 API Reference

### Dataset Generation

#### `generateDataset(schema, options)`

Generate a complete dataset with concurrent execution.

**Parameters:**

- `schema: IMessageSchema` - Factory function returning conversation structure
- `options`:
  - `count: number` - Number of examples to generate
  - `model: LanguageModel` - AI SDK language model (openai, anthropic, etc.)
  - `output?: string` - Output file path (auto-generated if not provided)
  - `seed?: number` - Random seed for reproducibility
  - `concurrency?: number` - Concurrent generations (default: 5)
  - `generationContext?: GenerationContext` - Custom generation instructions

**Returns:** `Promise<IDatasetRow[]>`

### Message Schemas

#### `user({ content })`

Create a static user message.

```typescript
user({ content: "Hello, assistant!" });
```

#### `assistant({ content })`

Create a static assistant message.

```typescript
assistant({ content: "Hello! How can I help?" });
```

#### `system({ content })`

Create a system message.

```typescript
system({ content: "You are a helpful assistant." });
```

#### `generatedUser({ prompt })`

Generate a user message with AI.

```typescript
generatedUser({
  prompt: "User asks about machine learning basics",
});
```

#### `generatedAssistant({ prompt })`

Generate an assistant message with AI.

```typescript
generatedAssistant({
  prompt: "Explain the concept clearly with an example",
});
```

### Tool Schemas

#### `tool({ name, description, parameters, output })`

Define a tool with Zod schemas.

```typescript
const myTool = tool({
  name: "calculate",
  description: "Perform calculations",
  parameters: z.object({
    operation: z.enum(["add", "subtract", "multiply", "divide"]),
    a: z.number(),
    b: z.number(),
  }),
  output: z.object({
    result: z.number(),
  }),
});
```

**Returns:** `IToolDefinition` with methods:

- `toolFunction()` - Register the tool
- `toolCall(id, args)` - Create tool call
- `toolCallResult(id, result)` - Create tool result

#### `generatedToolCall(tool, id, options?)`

Generate a tool call with AI-generated arguments.

```typescript
generatedToolCall(myTool, "call-1");
generatedToolCall(myTool, "call-2", { reuseArgsFrom: "call-1" });
```

#### `generatedToolCallResult(tool, id, result?)`

Generate a tool result. If `result` is omitted, it's AI-generated.

```typescript
generatedToolCallResult(myTool, "call-1");
generatedToolCallResult(myTool, "call-2", { result: 42 });
```

### Composition Utilities

#### `oneOf(options)`

Randomly select one option.

```typescript
oneOf([user({ content: "Hi" }), user({ content: "Hello" })])();
```

#### `times(n, pattern)`

Repeat a pattern n times.

```typescript
...times(3, [
  generatedUser({ prompt: "Ask question" }),
  generatedAssistant({ prompt: "Answer" })
])
```

#### `between(min, max)`

Generate random number between min and max (inclusive).

```typescript
...times(between(1, 5), pattern)
```

#### `optional(message)`

Include message with 50% probability.

```typescript
optional(assistant({ content: "Anything else?" }));
```

## 🎨 CLI Features

Torque includes a beautiful CLI interface with:

- **Real-time progress bar** showing completed/in-progress generations
- **Per-generation step tracking** (e.g., "user message", "tool-call (web_search)")
- **Token counting** for messages and tools
- **Concurrent execution** with configurable workers
- **Seed display** for reproducible runs
- **Output file location** clearly shown

Example output:

```
╭────────────────────────────────────────────────────╮
│ Dataset Generation                                 │
├────────────────────────────────────────────────────┤
│ Total:       100                                   │
│ Completed:   45                                    │
│ In Progress: 5                                     │
│ Seed:        42                                    │
│ Output:      data/dataset_2025-10-30.jsonl        │
│ Workers:     5                                     │
├────────────────────────────────────────────────────┤
│ ████████████░░░░░░░░░░░░░ 45%                     │
├────────────────────────────────────────────────────┤
│ #0: [████████████████░░░░] 80% tool-result (search)│
│ #1: [██████░░░░░░░░░░░░░░] 30% user message       │
│ #2: [████████████████████] 100% Writing...         │
│ #3: [██░░░░░░░░░░░░░░░░░░] 10% assistant message  │
│ #4: [██████████░░░░░░░░░░] 50% tool-call (calc)   │
╰────────────────────────────────────────────────────╯
```

## 🔐 TypeScript Support

Torque is built with TypeScript and provides complete type safety:

```typescript
// Full type inference for tool parameters
const weatherTool = tool({
  name: "weather",
  parameters: z.object({
    location: z.string(),
    units: z.enum(["C", "F"]),
  }),
  output: z.object({
    temp: z.number(),
    condition: z.string(),
  }),
});

// TypeScript knows the shape of parameters and output
weatherTool.toolCall("t1", {
  location: "NYC",
  units: "C", // ✅ Type-safe
  // units: 'K' // ❌ TypeScript error
});

weatherTool.toolCallResult("t1", {
  temp: 72,
  condition: "Sunny", // ✅ Type-safe
  // humidity: 50 // ❌ TypeScript error
});
```

## 🤝 Contributing

Contributions are welcome! This is part of a larger project exploring async tool patterns in LLMs.

## 📄 License

MIT License - see [LICENSE](LICENSE) for details

## 🌟 Examples

Check out the [`examples/`](examples/) directory for more use cases:

- Basic conversations
- Tool calling patterns
- Async tool workflows
- Multi-turn dialogues
- Custom generation contexts

## 🔗 Related

Built with:

- [Vercel AI SDK](https://sdk.vercel.ai) - Universal AI provider interface
- [Zod](https://zod.dev) - TypeScript-first schema validation
- [Bun](https://bun.sh) - Fast JavaScript runtime

---

**Made with ❤️ for the AI tinkerers community**
