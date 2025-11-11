/**
 * Email and Messaging Tools
 *
 * Tools for sending emails, messages, and managing communications.
 * Demonstrates action-oriented tools with confirmation outputs.
 */

import { tool } from "../../src/schema";
import { z } from "zod";

export const sendEmailTool = tool({
  name: "send_email",
  description: "Send an email to one or more recipients",
  parameters: z.object({
    to: z
      .array(z.string().email())
      .min(1)
      .describe("Email addresses of recipients"),
    subject: z.string().describe("Email subject line"),
    body: z.string().describe("Email body content"),
    cc: z.array(z.string().email()).optional().describe("CC recipients"),
    bcc: z.array(z.string().email()).optional().describe("BCC recipients"),
    attachments: z
      .array(z.string())
      .optional()
      .describe("File paths or URLs of attachments"),
  }),
  output: z.object({
    message_id: z.string().describe("Unique identifier for the sent email"),
    status: z.enum(["sent", "queued", "failed"]),
    timestamp: z.string().describe("When the email was sent"),
    recipients_count: z.number().int().optional(),
  }),
});

export const searchEmailTool = tool({
  name: "search_emails",
  description: "Search through emails using filters",
  parameters: z.object({
    query: z.string().optional().describe("Search query for email content"),
    from: z.string().optional().describe("Filter by sender email"),
    to: z.string().optional().describe("Filter by recipient email"),
    subject: z.string().optional().describe("Filter by subject keywords"),
    start_date: z
      .string()
      .optional()
      .describe("Start date for search (YYYY-MM-DD)"),
    end_date: z.string().optional().describe("End date for search (YYYY-MM-DD)"),
    limit: z.number().int().min(1).max(100).default(20).optional(),
  }),
  output: z.object({
    emails: z.array(
      z.object({
        id: z.string(),
        from: z.string().email(),
        to: z.array(z.string().email()),
        subject: z.string(),
        body_preview: z.string(),
        timestamp: z.string(),
        has_attachments: z.boolean().optional(),
      })
    ),
    total_count: z.number().int().optional(),
  }),
});

export const sendSlackMessageTool = tool({
  name: "send_slack_message",
  description: "Send a message to a Slack channel or user",
  parameters: z.object({
    channel: z
      .string()
      .describe("Channel name (e.g., #general) or user ID to send message to"),
    text: z.string().describe("Message text content"),
    thread_ts: z
      .string()
      .optional()
      .describe("Timestamp of parent message to reply in thread"),
    blocks: z
      .array(z.record(z.string(), z.any()))
      .optional()
      .describe("Rich message blocks for formatting"),
  }),
  output: z.object({
    message_ts: z.string().describe("Timestamp of the sent message"),
    channel_id: z.string(),
    status: z.enum(["sent", "failed"]),
  }),
});

