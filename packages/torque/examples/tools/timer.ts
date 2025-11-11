/**
 * Timer and Reminder Tools
 *
 * Tools for scheduling, timers, and reminders.
 * Useful for training models to handle time-based operations.
 */

import { tool } from "../../src/schema";
import { z } from "zod";

export const setTimerTool = tool({
  name: "set_timer",
  description: "Set a timer for a specified duration",
  parameters: z.object({
    duration_seconds: z
      .number()
      .int()
      .min(1)
      .describe("Timer duration in seconds"),
    label: z.string().optional().describe("Optional label for the timer"),
  }),
  output: z.object({
    timer_id: z.string().describe("Unique identifier for the timer"),
    expires_at: z.string().describe("ISO timestamp when timer will expire"),
    status: z.enum(["active", "error"]),
  }),
});

export const createReminderTool = tool({
  name: "create_reminder",
  description: "Create a reminder for a specific time or date",
  parameters: z.object({
    title: z.string().describe("Reminder title"),
    description: z.string().optional().describe("Detailed description"),
    remind_at: z
      .string()
      .describe("When to trigger reminder (ISO datetime or natural language)"),
    recurrence: z
      .enum(["none", "daily", "weekly", "monthly", "yearly"])
      .default("none")
      .optional(),
    priority: z.enum(["low", "medium", "high"]).default("medium").optional(),
  }),
  output: z.object({
    reminder_id: z.string(),
    remind_at: z.string().describe("Scheduled time in ISO format"),
    status: z.enum(["scheduled", "error"]),
  }),
});

export const listRemindersTool = tool({
  name: "list_reminders",
  description: "List all active reminders",
  parameters: z.object({
    status: z
      .enum(["active", "completed", "all"])
      .default("active")
      .optional()
      .describe("Filter reminders by status"),
    start_date: z
      .string()
      .optional()
      .describe("Filter reminders after this date"),
    end_date: z
      .string()
      .optional()
      .describe("Filter reminders before this date"),
  }),
  output: z.object({
    reminders: z.array(
      z.object({
        reminder_id: z.string(),
        title: z.string(),
        description: z.string().optional(),
        remind_at: z.string(),
        status: z.enum(["active", "completed", "snoozed"]),
        priority: z.enum(["low", "medium", "high"]),
      })
    ),
    total_count: z.number().int(),
  }),
});

export const cancelTimerTool = tool({
  name: "cancel_timer",
  description: "Cancel an active timer or reminder",
  parameters: z.object({
    timer_id: z.string().describe("ID of timer or reminder to cancel"),
  }),
  output: z.object({
    timer_id: z.string(),
    status: z.enum(["cancelled", "not_found", "already_expired"]),
  }),
});
