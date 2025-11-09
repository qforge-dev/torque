import type { IDatasetRow } from "@qforge/torque";

const DEFAULT_SINGLE_INSTRUCTIONS = `You are judging synthetic data—the facts can be fabricated. Focus on whether each detail is internally consistent with the conversation, schema, and tool usage.

Schema structure reminder:
- Schema metadata: high-level scenario intent or constraints.
- Schema plan: ordered role prompts describing each message's target role/content (role order, speaker sequence, and tool-call placement are enforced automatically).
- Tools: callable functions, their descriptions, and expected arguments/results (argument/result schemas are enforced—shapes will be valid, but meaning might still be nonsensical).

The generator already guarantees that the conversation follows the scripted sequence (e.g., USER → ASSISTANT → TOOL CALL → TOOL RESULT → ASSISTANT), so do not award or deduct points solely because the turn order matches the plan—only penalize when the *content* contradicts the schema intent or tool semantics.

Score each dimension on 0-10.

Quality (usefulness & realism):
- Messages respect the schema prompts and intent rather than copy them verbatim.
- Tool calls/results go beyond structural correctness and semantically address the user request.
- Content feels grounded in the conversation without meta-commentary or contradictions.

Coherence (logical flow):
- Conversation progresses naturally from prior turns toward the planned future turns.
- Tool arguments/results stay consistent with what surrounds them.

Adherence (obedience & safety):
- Assistant satisfies all user/system instructions and policy constraints.
- Responses stay in-role, avoid unsafe behavior, and do not invent unsupported steps.

If a row violates multiple criteria, the lowest dimension should capture the severity.

Examples:
- Strong row: assistant follows the schema, calls tools with valid args, and summarizes tool results before replying -> quality 9, coherence 9, adherence 9.
- Weak row: assistant ignores the tool plan and invents data instead of calling the required search tool -> quality 3, coherence 4, adherence 2.

Example JSON: {"quality":8,"coherence":7,"adherence":8,"notes":"Assistant cites the scraped data but misses a minor instruction."}

Penalize semantically nonsensical tool usage (even if schema-valid), contradictions, broken continuity, or policy issues. Reward rows that honor the DSL plan and produce meaningful synthetic data.`;

const DEFAULT_PAIR_INSTRUCTIONS = `All rows contain synthetic (fabricated) data. Role order, speaker sequencing, and tool-call placement already match the schema plan; judge whether each row makes semantic, contextual sense despite that scaffolding.

Use the same Quality / Coherence / Adherence definitions:
- Quality checks schema alignment, realistic content, and proper tool usage.
- Coherence checks conversational flow and consistency of tool inputs/outputs.
- Adherence checks instruction following, safety, and staying in-role.

Structure is not up for debate: both rows already follow the scripted turn order. Focus on whether their *content*, tool arguments, and summaries honor the scenario intent, required formats, and timing constraints.

Comparison priorities (apply in order and stop once a decisive difference appears):
1. Schema plan + format fidelity: rows must follow the scripted plan (e.g., casual fillers vs. tool-heavy turns), honor timing around tool availability, and return outputs in the exact format the user/schema demands. Dropping a required tool result or responding in the wrong format is a severe adherence failure.
2. Tool integrity: tool calls, acknowledgements, and final summaries must stay deterministic. Penalize rows that invent tool statuses, contradict a tool’s output, or fail to integrate every tool result that was fetched.
3. Content flow and safety: prefer rows whose conversations stay on-topic, resolve user requests, and remain safe/consistent once the above constraints are satisfied.

Comparison guidance:
- Prefer rows that track the schema plan, role prompts, and tool schemas without skipping or reordering required steps.
- Prefer deterministic tool behavior (args/results match context and schema, and final answers mirror those results).
- Consider severity: hallucinating a tool result or ignoring a required format outweighs minor style issues.

Examples:
- If Row A obeys the delay plan by repeatedly saying results are still loading until the final tool output, while Row B fabricates an “empty” result early, choose "A".
- If Row A combines every required tool output into the JSON the user requested but Row B replies with a prose list instead, choose "A".
- If both rows follow every instruction (including format/timing) and differ only in tone, return "tie".

Example JSON: {"winner":"B","rationale":"Row B uses the enforced lookup schema to retrieve data relevant to the user question; Row A returns schema-shaped but nonsensical numbers."}

Return "tie" only when both rows satisfy every instruction, format, and tool requirement to the same degree.`;

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
