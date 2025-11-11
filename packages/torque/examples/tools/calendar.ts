/**
 * Calendar and Event Tools
 *
 * Tools for managing calendar events, scheduling meetings, and checking availability.
 * Demonstrates temporal data and scheduling operations.
 */

import { tool } from "../../src/schema";
import { z } from "zod";

export const createEventTool = tool({
  name: "create_calendar_event",
  description: "Create a new calendar event",
  parameters: z.object({
    title: z.string().describe("Event title"),
    start_time: z.string().describe("Event start time (ISO datetime)"),
    end_time: z.string().describe("Event end time (ISO datetime)"),
    description: z.string().optional().describe("Event description"),
    location: z.string().optional().describe("Event location"),
    attendees: z
      .array(z.string().email())
      .optional()
      .describe("Email addresses of attendees"),
    reminder_minutes: z
      .number()
      .int()
      .optional()
      .describe("Minutes before event to send reminder"),
    recurrence: z
      .enum(["none", "daily", "weekly", "monthly"])
      .default("none")
      .optional(),
  }),
  output: z.object({
    event_id: z.string().describe("Unique event identifier"),
    created_at: z.string(),
    calendar_link: z.string().url().optional(),
    status: z.enum(["created", "error"]),
  }),
});

export const checkAvailabilityTool = tool({
  name: "check_availability",
  description: "Check calendar availability for specific time slots",
  parameters: z.object({
    start_date: z.string().describe("Start date to check (YYYY-MM-DD)"),
    end_date: z.string().describe("End date to check (YYYY-MM-DD)"),
    attendees: z
      .array(z.string().email())
      .optional()
      .describe("Check availability for these attendees"),
    duration_minutes: z
      .number()
      .int()
      .min(15)
      .optional()
      .describe("Desired meeting duration"),
  }),
  output: z.object({
    available_slots: z.array(
      z.object({
        start_time: z.string(),
        end_time: z.string(),
        all_attendees_free: z.boolean().optional(),
      })
    ),
    busy_slots: z
      .array(
        z.object({
          start_time: z.string(),
          end_time: z.string(),
          reason: z.string().optional(),
        })
      )
      .optional(),
  }),
});

export const listEventsTool = tool({
  name: "list_calendar_events",
  description: "List calendar events within a date range",
  parameters: z.object({
    start_date: z.string().describe("Start date (YYYY-MM-DD)"),
    end_date: z.string().describe("End date (YYYY-MM-DD)"),
    calendar_id: z
      .string()
      .optional()
      .describe("Specific calendar ID to query"),
    search: z.string().optional().describe("Search term to filter events"),
  }),
  output: z.object({
    events: z.array(
      z.object({
        event_id: z.string(),
        title: z.string(),
        start_time: z.string(),
        end_time: z.string(),
        location: z.string().optional(),
        attendees_count: z.number().int().optional(),
        status: z.enum(["confirmed", "tentative", "cancelled"]).optional(),
      })
    ),
    total_count: z.number().int(),
  }),
});

export const updateEventTool = tool({
  name: "update_calendar_event",
  description: "Update an existing calendar event",
  parameters: z.object({
    event_id: z.string().describe("Event ID to update"),
    title: z.string().optional().describe("New event title"),
    start_time: z.string().optional().describe("New start time"),
    end_time: z.string().optional().describe("New end time"),
    description: z.string().optional(),
    location: z.string().optional(),
    status: z.enum(["confirmed", "tentative", "cancelled"]).optional(),
  }),
  output: z.object({
    event_id: z.string(),
    updated_at: z.string(),
    status: z.enum(["updated", "not_found", "error"]),
    notification_sent: z.boolean().optional(),
  }),
});

export const deleteEventTool = tool({
  name: "delete_calendar_event",
  description: "Delete a calendar event",
  parameters: z.object({
    event_id: z.string().describe("Event ID to delete"),
    notify_attendees: z
      .boolean()
      .default(true)
      .optional()
      .describe("Send cancellation notice to attendees"),
    cancellation_message: z
      .string()
      .optional()
      .describe("Optional message to include in cancellation notice"),
  }),
  output: z.object({
    event_id: z.string(),
    status: z.enum(["deleted", "not_found", "error"]),
    attendees_notified: z.number().int().optional(),
  }),
});

