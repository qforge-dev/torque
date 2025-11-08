import type { IDatasetRow } from "@qforge/torque";

const DEFAULT_SINGLE_INSTRUCTIONS =
  "Score the example on 0-10 for quality (overall usefulness), coherence (logical flow), and adherence (whether assistant responses answer the user and stay safe). Penalize hallucinations, violations, or missing steps.";

const DEFAULT_PAIR_INSTRUCTIONS =
  "Choose the dataset row that better satisfies the user and maintains factual, safe, high-quality responses. Prefer answers that follow the schema intent, stay consistent, and avoid policy issues. Output tie only if both are virtually equal.";

function truncate(text: string, max = 300): string {
  if (text.length <= max) {
    return text;
  }
  return text.slice(0, max).trimEnd() + "…";
}

function formatContent(content: any): string {
  if (!content) return "";
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (part && typeof part === "object") {
          if (typeof part.text === "string") return part.text;
          if (typeof part.content === "string") return part.content;
        }
        return JSON.stringify(part);
      })
      .join("\n");
  }
  if (typeof content === "object") {
    if (typeof (content as any).text === "string") {
      return (content as any).text;
    }
    return JSON.stringify(content);
  }
  return String(content);
}

function formatMessages(row: IDatasetRow): string {
  return row.messages
    .map((message, idx) => {
      const body = truncate(formatContent(message.content), 600);
      return `${idx + 1}. ${message.role.toUpperCase()} :: ${body}`;
    })
    .join("\n\n");
}

function formatSchema(row: IDatasetRow): string {
  if (!row.schema) {
    return "Schema metadata: not captured for this row.";
  }

  const metadata =
    row.schema.metadata && Object.keys(row.schema.metadata).length > 0
      ? JSON.stringify(row.schema.metadata, null, 2)
      : "None";

  const messagePlan = row.schema.messages
    .map(
      (message, idx) =>
        `${idx + 1}. ${message.role.toUpperCase()} (${
          message.role ?? "text"
        }) :: ${truncate(
          "content" in message ? String((message as any).content ?? "") : "",
          120
        )}`
    )
    .join("\n");

  const tools =
    row.schema.tools.length > 0
      ? row.schema.tools
          .map(
            (tool) => `- ${tool.name}: ${truncate(tool.description ?? "", 120)}`
          )
          .join("\n")
      : "None";

  return `Schema metadata: ${metadata}

Schema plan:
${messagePlan || "No schema messages recorded."}

Tools:
${tools}`;
}

export function buildSinglePrompt(
  row: IDatasetRow,
  instructions = DEFAULT_SINGLE_INSTRUCTIONS
): string {
  const schemaSection = formatSchema(row);
  const messageSection = formatMessages(row);

  return `You are judging the quality of a synthetic LLM dataset example.

${schemaSection}

Conversation transcript:
${messageSection}

${instructions}

Return strict JSON:
{"quality": number (0-10), "coherence": number (0-10), "adherence": number (0-10), "notes": string}`;
}

export function buildPairPrompt(
  rowA: IDatasetRow,
  rowB: IDatasetRow,
  instructions = DEFAULT_PAIR_INSTRUCTIONS
): string {
  const schemaA = formatSchema(rowA);
  const schemaB = formatSchema(rowB);

  const conversationA = formatMessages(rowA);
  const conversationB = formatMessages(rowB);

  return `You are comparing two dataset rows from the same schema. ${instructions}

ROW A SCHEMA:
${schemaA}

ROW A MESSAGES:
${conversationA}

ROW B SCHEMA:
${schemaB}

ROW B MESSAGES:
${conversationB}

Return strict JSON:
{"winner":"A"|"B"|"tie","rationale":string}`;
}
