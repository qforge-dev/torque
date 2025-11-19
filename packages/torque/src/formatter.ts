import type { IDatasetRow, DatasetExportFormat } from "./types";

export interface IDatasetFormatter {
  format(row: IDatasetRow): Record<string, any>;
  parquetSchema: Record<string, any>;
}

export class AiSdkFormatter implements IDatasetFormatter {
  parquetSchema = {
    messages: { type: "UTF8" }, // JSON string
    tools: { type: "UTF8" }, // JSON string
    schema: { type: "UTF8" }, // JSON string
    meta: { type: "UTF8" }, // JSON string
  };

  format(row: IDatasetRow): Record<string, any> {
    return row as unknown as Record<string, any>;
  }
}

export class ChatTemplateFormatter implements IDatasetFormatter {
  parquetSchema = {
    tools: { type: "UTF8" }, // JSON string
    messages: { type: "UTF8" }, // JSON string
  };

  format(row: IDatasetRow): Record<string, any> {
    const tools = row.tools.map((tool) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));

    const messages = row.messages.map((msg) => {
      let contentParts: any[] = [];

      if (typeof msg.content === "string") {
        contentParts = [{ type: "text", text: msg.content }];
      } else if (Array.isArray(msg.content)) {
        contentParts = msg.content.map((part: any) => {
          if (part.type === "text") {
            return { type: "text", text: part.text };
          }
          if (part.type === "image") {
            // Pass through image parts
            return { ...part };
          }
          if (part.type === "reasoning") {
            return {
              type: "reasoning",
              text: part.text || part.reasoning || "",
            };
          }
          if (part.type === "tool-call") {
            return {
              type: "tool_call",
              id: part.toolCallId,
              name: part.toolName,
              arguments: part.input, // Assuming input is the arguments object
            };
          }
          if (part.type === "tool-result") {
            return {
              type: "tool_result",
              tool_call_id: part.toolCallId,
              name: part.toolName,
              content: part.output || part.result,
            };
          }
          // Pass through any other parts (e.g. video)
          return part;
        });
      }

      return {
        role: msg.role,
        content: contentParts,
      };
    });

    return { tools, messages };
  }
}

export function createFormatter(
  format: DatasetExportFormat
): IDatasetFormatter {
  switch (format) {
    case "ai-sdk":
      return new AiSdkFormatter();
    case "chat_template":
      return new ChatTemplateFormatter();
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}
