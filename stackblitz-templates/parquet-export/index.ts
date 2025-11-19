

import { openai } from "@ai-sdk/openai";
import { generateDataset, user, assistant } from "@qforge/torque";
await generateDataset(
  () => [
    user({ content: "Hello, how are you?" }),
    assistant({ content: "I'm doing well, thank you!" }),
  ],
  {
    count: 10,
    model: openai("gpt-5-mini"),
    format: "parquet",
    output: "data/parquet-export.parquet",
  }
);
