# Torque

**Torque** is a declarative, fully typesafe DSL for quickly building complex LLM synthetic datasets. Compose conversations like components, generate realistic variations with any model efficiently.

[![npm version](https://img.shields.io/npm/v/@qforge/torque.svg)](https://www.npmjs.com/package/@qforge/torque)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

## ✨ Features

- **🎯 Declarative DSL** - Compose conversations like components
- **🔒 Fully Typesafe** - Zod schemas with complete type inference
- **🔌 Provider Agnostic** - Generate with any AI SDK provider (OpenAI, Anthropic, DeepSeek, vLLM, LLaMA.cpp etc.)
- **🤖 AI-Powered Content** - Generate realistic varied datasets automatically without complicated scripts
- **🎭 Faker Integration** - Built-in Faker.js with automatic seed synchronization for reproducible fake data
- **💰 Cache Optimized** - Reuses context across generations to reduce costs
- **📉 Prompt Optimized** - Concise, optimized structures, prompts and generation workflow lets you use smaller, cheaper models
- **♻️ Reusable Patterns** - Build libraries of conversation templates
- **⚡ Concurrent Generation** - Beautiful async CLI with real-time progress tracking while generating concurrently

## 🚀 Quick Example

```typescript
import {
  generateDataset,
  generatedUser,
  generatedAssistant,
  assistant,
  oneOf,
} from "@qforge/torque";
import { openai } from "@ai-sdk/openai";

await generateDataset(
  () => [
    generatedUser({ prompt: "Friendly greeting or introduction" }), // AI generated
    oneOf([
      // pick one randomly (weights are optional)
      { value: assistant({ content: "Hello!" }), weight: 0.3 }, // static
      generatedAssistant({ prompt: "Respond to greeting" }), // AI generated, gets remaining weight
    ]),
    ...times(between(1, 3), [
      generatedUser({
        prompt: "Chat about weather. Optionally mentioning previous message",
      }),
      generatedAssistant({ prompt: "Respond to user. Short and concise." }),
    ]),
  ],
  {
    count: 2, // number of examples
    model: openai("gpt-5-mini"), // any ai-sdk model
    seed: 42, // replayable RNG
    metadata: { example: "quick-start" }, // optional per-row metadata
  }
);
```

Outputs:

```json
{"messages":[{"role":"user","content":[{"type":"text","text":"Hi there! I'm new here and just wanted to say hello."}]},{"role":"assistant","content":[{"type":"text","text":"Hello!"}]},{"role":"user","content":[{"type":"text","text":"The sunshine today is perfect for a walk in the park."}]},{"role":"assistant","content":[{"type":"text","text":"Absolutely—warm and bright out there."}]},{"role":"user","content":[{"type":"text","text":"Do you think the clouds will roll in later this evening?"}]},{"role":"assistant","content":[{"type":"text","text":"Maybe briefly, but it should stay mostly clear."}]}]}

{"messages":[{"role":"user","content":[{"type":"text","text":"Hey! Hope you're having a great day."}]},{"role":"assistant","content":[{"type":"text","text":"Hi there! I'm doing great—what can I help you with?"}]},{"role":"user","content":[{"type":"text","text":"The weather keeps flipping between sun and drizzle lately."}]},{"role":"assistant","content":[{"type":"text","text":"Totally—it’s been bouncing around all week."}]},{"role":"user","content":[{"type":"text","text":"Should I expect rain again tonight?"}]},{"role":"assistant","content":[{"type":"text","text":"Pack an umbrella just in case; there’s a chance of showers."}]},{"role":"user","content":[{"type":"text","text":"Thanks! I’ll be prepared if it turns stormy."}]},{"role":"assistant","content":[{"type":"text","text":"Good call—better to stay dry than sorry."}]}]}
```

> 💡 See full example: [`examples/quick-start.ts`](examples/quick-start.ts) | [▶️ Try in Browser](https://stackblitz.com/github/qforge-dev/torque/tree/main/stackblitz-templates/quick-start)

## 🤔 Why Torque?

Building synthetic datasets for LLMs is tedious:

- Sometimes you don’t have enough real data
- Manual conversation writing doesn’t scale as conversations get long
- Maintaining quality and consistency across thousands of examples is extremely time consuming
- Tool calling patterns require intricate message sequences and are error‑prone
- Generating different conversation flows means rewriting everything or creating various hard to maintain scripts
- Designing generators that are random yet reproducible is surprisingly complex
- Getting AI to understand complex composition scenarios (nested variations, conditional flows) takes significant prompt engineering time

**Torque solves this** with a declarative approach. Just like React transformed UI development from imperative DOM manipulation to composable components, Torque transforms dataset generation from manual JSON editing or writing complicated scripts to declarative conversation schemas. Plus, its optimized structure means you can use smaller, cheaper models while benefiting from cache optimization for lower costs.

## 📦 Installation

```bash
npm install @qforge/torque
# or
bun add @qforge/torque
```

## 📚 Core Concepts

### Message Schemas

Build conversations by composing message schemas, you can compose them together to build complex conversations from reusable parts:

```typescript
// Reusable greeting pattern
const greeting = () => [
  system({ content: "You are a helpful assistant." }),
  user({ content: "Hello!" }),
  assistant({ content: "Hi! How can I help?" }),
];

// Compose it with additional conversation
const extendedSchema = () => [
  ...greeting(),
  user({ content: "What's the weather like?" }),
  assistant({ content: "I'd be happy to check that for you!" }),
];

// Or create variations
const formalGreeting = () => [
  system({ content: "You are a professional assistant." }),
  user({ content: "Good morning." }),
  assistant({ content: "Good morning. How may I assist you today?" }),
];

const schema = () => [
  // Weighted selection between schema branches
  oneOf([
    { value: greeting(), weight: 0.6 },
    formalGreeting(),
    extendedSchema(),
  ]),
  // Continue with shared conversation flow
  generatedUser({ prompt: "Ask a question" }),
  generatedAssistant({ prompt: "Provide helpful answer" }),
];
```

> 💡 See full example: [`examples/schema-composition.ts`](examples/schema-composition.ts) | [▶️ Try in Browser](https://stackblitz.com/github/qforge-dev/torque/tree/main/stackblitz-templates/schema-composition)

### Row Metadata

Use `metadata({ ... })` inside your schema to hoist custom fields into the generated row. The values merge with any metadata you pass directly to `generateDataset`, with schema-level keys taking precedence on conflicts.

```typescript
const schema = () => [
  system({ content: "You are a helpful assistant." }),
  oneOf([
    () => [metadata({ variant: "static" }), assistant({ content: "Hello!" })],
    () => [
      metadata({ variant: "generated" }),
      generatedAssistant({ prompt: "Greet the user warmly" }),
    ],
  ]),
];
```

When the dataset is saved, you can read these values under `row.meta.metadata`.

### Composition Utilities

Build dynamic, varied datasets with composition helpers:

```typescript
import { oneOf, times, between, optional } from "@qforge/torque";

const schema = () => [
  // Choose randomly from options (weights optional)
  oneOf([
    user({ content: "Hello" }),
    { weight: 0.5, value: user({ content: "Hi there" }) },
    user({ content: "Hey" }),
  ]),

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

`oneOf` accepts plain schema entries or `{ value, weight }` objects. Provide any subset of weights (summing to ≤ 1) and the remaining probability is spread evenly across unweighted entries.

> 💡 See weighted example: [`examples/weighted-one-of.ts`](examples/weighted-one-of.ts)  
> 💡 Full utilities demo: [`examples/composition-utilities.ts`](examples/composition-utilities.ts) | [▶️ Try in Browser](https://stackblitz.com/github/qforge-dev/torque/tree/main/stackblitz-templates/composition-utilities)

### Tool Definitions

Define tools with Zod schemas for complete type safety:

```typescript
import {
  tool,
  generatedToolCall,
  generatedToolCallResult,
} from "@qforge/torque";
import { z } from "zod";

// use standard tool schema using zod ensuring complete type safety
const weatherTool = tool({
  name: "get_weather",
  description: "Get current weather for a location",
  parameters: z.object({
    location: z.string().describe("City name"),
    units: z.enum(["C", "F"]).optional(),
  }),
  output: z.object({
    temperature: z.number(),
    condition: z.string(),
  }),
});

const schema = () => [
  weatherTool.toolFunction(),
  generatedUser({ prompt: "Ask about weather in a city" }),
  generatedToolCall(weatherTool, "t1"), // type safe 100% correct generated tool calls
  generatedToolCallResult(weatherTool, "t1"), // similarly 100% correct generated tool results
  generatedAssistant({ prompt: "Interpret the weather data for the user" }),
];
```

> 💡 See full example: [`examples/tool-calling.ts`](examples/tool-calling.ts) | [▶️ Try in Browser](https://stackblitz.com/github/qforge-dev/torque/tree/main/stackblitz-templates/tool-calling)

### 🔐 TypeScript Support

Torque is built with TypeScript and provides complete type safety. Both for user and AI generating the data.
Ensure that the arguments and tool results are always matching schema.

```typescript
// Full type inference for tool parameters
const weatherTool = tool({
  name: "get_weather",
  description: "Get current weather for a location",
  parameters: z.object({
    location: z.string().describe("City name"),
    units: z.enum(["C", "F"]).optional(),
  }),
  output: z.object({
    temperature: z.number(),
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

### Two-Phase Execution

Torque executes in two phases:

1. **Check Phase** - Analyzes conversation structure, registers tools
2. **Generate Phase** - Creates actual content with AI generation

This enables:

- AI awareness of what are the exact steps in the conversation before generating content - you can create schemas where LLM "fills the gaps"
- Accurate progress tracking
- Pre-validation of conversation flow

### Reproducible Generation with Seeds

Control randomness for reproducible datasets:

```typescript
await generateDataset(schema, {
  count: 50,
  model: openai("gpt-5-mini"),
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

    // Tool call generated based on the user request
    generatedToolCall(searchTool, "search-1"),

    // Immediate acknowledgment
    searchTool.toolCallResult("search-1", "<tool_ack />"),

    generatedAssistant({
      prompt: "Acknowledge search started, assure user it's in progress",
    }),

    // Filler conversation while waiting.
    // While generating AI is aware how many messages are left.
    ...times(between(1, 3), [
      generatedUser({ prompt: "Casual conversation, unrelated to search" }),
      generatedAssistant({ prompt: "Respond naturally to casual topic" }),
    ]),

    // Actual result arrives with reused arguments
    generatedToolCall(searchTool, "search-1-FINAL", {
      reuseArgsFrom: "search-1",
    }),
    // Generated actual result based on previously generated tool call
    generatedToolCallResult(searchTool, "search-1-FINAL"),
    generatedAssistant({ prompt: "Present search results to user" }),
  ],
  {
    count: 50,
    model: openai("gpt-5-mini"),
    output: "data/async-tools.jsonl",
  }
);
```

> 💡 See full example: [`examples/async-tools.ts`](examples/async-tools.ts) | [▶️ Try in Browser](https://stackblitz.com/github/qforge-dev/torque/tree/main/stackblitz-templates/async-tools)

### Custom Generation Context

Guide the AI's generation style globally:

```typescript
await generateDataset(schema, {
  count: 100,
  model: openai("gpt-5-mini"),
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

> 💡 See full example: [`examples/custom-generation-context.ts`](examples/custom-generation-context.ts) | [▶️ Try in Browser](https://stackblitz.com/github/qforge-dev/torque/tree/main/stackblitz-templates/custom-generation-context)

### Multiple Tool Variations

Generate datasets with different tools:

```typescript
import { oneOf } from "@qforge/torque";

const tools = [weatherTool, calculatorTool, searchTool];

await generateDataset(
  () => {
    const tool = oneOf(tools);

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
    model: openai("gpt-5-mini"),
    output: "data/multi-tool.jsonl",
  }
);
```

> 💡 See full example: [`examples/multiple-tool-variations.ts`](examples/multiple-tool-variations.ts) | [▶️ Try in Browser](https://stackblitz.com/github/qforge-dev/torque/tree/main/stackblitz-templates/multiple-tool-variations)

### Realistic Fake Data with Faker

Torque includes built-in [Faker.js](https://fakerjs.dev/) integration that automatically respects the seed system for reproducible fake data generation:

```typescript
import {
  generateDataset,
  generatedUser,
  generatedAssistant,
  faker,
} from "@qforge/torque";

await generateDataset(
  () => [
    generatedUser({
      prompt: `Introduce yourself as ${faker.person.fullName()} from ${faker.location.city()}`,
    }),
    generatedAssistant({
      prompt: "Greet the user warmly",
    }),
  ],
  {
    count: 100,
    model: openai("gpt-5-mini"),
    output: "data/personas.jsonl",
    seed: 42, // Same seed = same fake names and cities
  }
);
```

**Faker automatically uses Torque's seed system**, so:

- Same seed = identical fake data across runs
- No manual seed configuration needed
- Perfect for creating realistic user personas, product data, addresses, emails, etc.

**Common use cases:**

- User personas: `faker.person.fullName()`, `faker.person.jobTitle()`
- Locations: `faker.location.city()`, `faker.location.country()`
- E-commerce: `faker.commerce.productName()`, `faker.commerce.price()`
- Contact info: `faker.internet.email()`, `faker.phone.number()`
- Dates: `faker.date.future()`, `faker.date.past()`

> 💡 See full example: [`examples/faker-integration.ts`](examples/faker-integration.ts) | [▶️ Try in Browser](https://stackblitz.com/github/qforge-dev/torque/tree/main/stackblitz-templates/faker-integration)

## 🎨 CLI Features

Torque includes a beautiful CLI interface with:

- **Real-time progress bar** showing completed/in-progress generations
- **Per-generation step tracking** (e.g., "user message", "tool-call (web_search)")
- **Token counting** for messages and tools
- **Concurrent execution** with configurable workers
- **Seed display** for reproducible runs
- **Output file location** clearly shown

```
╭────────────────────────────────────────────────────╮
│ Dataset Generation                                 │
├────────────────────────────────────────────────────┤
│ Total:       100                                   │
│ Completed:   45                                    │
│ In Progress: 5                                     │
│ Seed:        42                                    │
│ Output:      data/dataset_2025-10-30.jsonl         │
│ Workers:     5                                     │
├────────────────────────────────────────────────────┤
│ ████████████░░░░░░░░░░░░░ 45%                      │
├────────────────────────────────────────────────────┤
│ #0: [████████████████░░░░] 80% tool-result (search)│
│ #1: [██████░░░░░░░░░░░░░░] 30% user message        │
│ #2: [████████████████████] 100% Writing...         │
│ #3: [██░░░░░░░░░░░░░░░░░░] 10% assistant message   │
│ #4: [██████████░░░░░░░░░░] 50% tool-call (calc)    │
╰────────────────────────────────────────────────────╯
```

## 🤝 Contributing

Contributions are welcome! This is part of a larger project exploring async tool patterns in LLMs.

## 📄 License

MIT License - see [LICENSE](LICENSE) for details

## 🔗 Related

Built with:

- [Vercel AI SDK](https://sdk.vercel.ai) - Universal AI provider interface
- [Zod](https://zod.dev) - TypeScript-first schema validation
- [Bun](https://bun.sh) - Fast JavaScript runtime

---

**Made with ❤️ for the AI tinkerers community**
