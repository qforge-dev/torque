/**
 * Weather Tools
 *
 * Tools for retrieving weather information and forecasts.
 * Demonstrates API-style data retrieval patterns.
 */

import { tool } from "../../src/schema";
import { z } from "zod";

export const weatherTool = tool({
  name: "get_weather",
  description: "Get current weather information for a location",
  parameters: z.object({
    location: z
      .string()
      .describe("City name, zip code, or coordinates (lat,lon)"),
    units: z
      .enum(["celsius", "fahrenheit", "kelvin"])
      .default("celsius")
      .optional()
      .describe("Temperature unit preference"),
  }),
  output: z.object({
    temperature: z.number().describe("Current temperature"),
    condition: z
      .string()
      .describe("Weather condition (e.g., 'sunny', 'cloudy', 'rainy')"),
    humidity: z
      .number()
      .min(0)
      .max(100)
      .optional()
      .describe("Humidity percentage"),
    wind_speed: z.number().optional().describe("Wind speed in km/h or mph"),
    feels_like: z.number().optional().describe("Perceived temperature"),
  }),
});

export const weatherForecastTool = tool({
  name: "get_weather_forecast",
  description: "Get weather forecast for upcoming days",
  parameters: z.object({
    location: z.string().describe("City name or coordinates"),
    days: z
      .number()
      .int()
      .min(1)
      .max(14)
      .default(7)
      .describe("Number of days to forecast"),
    units: z.enum(["celsius", "fahrenheit"]).default("celsius").optional(),
  }),
  output: z.object({
    forecast: z.array(
      z.object({
        date: z.string().describe("Date in YYYY-MM-DD format"),
        high: z.number().describe("High temperature"),
        low: z.number().describe("Low temperature"),
        condition: z.string().describe("Weather condition"),
        precipitation_chance: z
          .number()
          .min(0)
          .max(100)
          .optional()
          .describe("Chance of precipitation as percentage"),
      })
    ),
  }),
});
