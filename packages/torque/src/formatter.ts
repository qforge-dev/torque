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

    const messages = row.messages.flatMap((msg) => {
      if (msg.role === "tool") {
        // Flatten tool results
        if (Array.isArray(msg.content)) {
          return msg.content
            .map((part: any) => {
              if (part.type === "tool-result") {
                return {
                  role: "tool",
                  tool_call_id: part.toolCallId,
                  name: part.toolName,
                  content: JSON.stringify(part.output),
                };
              }
              return null;
            })
            .filter(Boolean);
        }
        return [];
      }

      if (msg.role === "assistant") {
        const toolCalls: any[] = [];
        let contentString = "";

        if (Array.isArray(msg.content)) {
          for (const part of msg.content) {
            if (part.type === "tool-call") {
              toolCalls.push({
                id: part.toolCallId,
                type: "function",
                function: {
                  name: part.toolName,
                  arguments: part.input,
                },
              });
            } else if (part.type === "text") {
              contentString += part.text;
            }
            // Skip reasoning for chat_template
          }
        } else if (typeof msg.content === "string") {
          contentString = msg.content;
        }

        const newMsg: any = {
          role: "assistant",
          content: contentString || null,
        };
        if (toolCalls.length > 0) {
          newMsg.tool_calls = toolCalls;
        }
        return [newMsg];
      }

      // User / System
      let content = msg.content;
      if (Array.isArray(content)) {
        // Ensure content parts are compatible
        // OpenAI accepts array of text/image parts.
        // We'll assume they are compatible or simplify if needed.
        // For now, pass through.
      }

      return [
        {
          role: msg.role,
          content,
        },
      ];
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
