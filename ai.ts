import {
  generateText,
  generateObject,
  type GenerateTextResult,
  type GenerateObjectResult,
  type LanguageModel,
  type ModelMessage,
  type ToolSet,
} from "ai";
import type { z } from "zod";

export interface IAiAgent {
  generateText: (
    messages: ModelMessage[]
  ) => Promise<GenerateTextResult<ToolSet, never>>;
  generateObject: <T extends z.ZodType>(
    schema: T,
    messages: ModelMessage[]
  ) => Promise<GenerateObjectResult<z.infer<T>>>;
}

type AiAgentArgs = {
  model: LanguageModel;
};

export class AiAgent {
  private model: LanguageModel;
  constructor({ model }: AiAgentArgs) {
    this.model = model;
  }

  async generateText(
    messages: ModelMessage[]
  ): Promise<GenerateTextResult<ToolSet, never>> {
    return generateText({
      model: this.model,
      messages,
    });
  }

  async generateObject<T extends z.ZodType>(
    schema: T,
    messages: ModelMessage[]
  ): Promise<GenerateObjectResult<z.infer<T>>> {
    return generateObject({
      model: this.model,
      schema,
      messages,
    });
  }
}

export function createAiAgent(args: AiAgentArgs): IAiAgent {
  return new AiAgent(args);
}
