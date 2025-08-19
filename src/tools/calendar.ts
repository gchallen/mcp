/**
 * Calendar tools for Microsoft Outlook integration
 */
import { z } from "zod"
import { zodToJsonSchema } from "zod-to-json-schema"
import { callGraphAPI, GRAPH_ENDPOINTS, GRAPH_FIELDS, buildODataQuery, GraphAPIResponse } from "../utils/graph-api.js"

// Input schemas for calendar tools
export const ListEventsSchema = z.object({
  count: z.number().min(1).max(50).optional().describe("Number of events to retrieve (default: 10, max: 50)"),
  startTime: z.string().optional().describe("Start time filter in ISO 8601 format (default: now)"),
  endTime: z.string().optional().describe("End time filter in ISO 8601 format (default: 30 days from now)"),
})

export const CreateEventSchema = z.object({
  subject: z.string().describe("The subject/title of the event"),
  start: z.string().describe("The start time of the event in ISO 8601 format (e.g., '2024-01-15T10:00:00')"),
  end: z.string().describe("The end time of the event in ISO 8601 format (e.g., '2024-01-15T11:00:00')"),
  attendees: z.array(z.string()).optional().describe("List of attendee email addresses"),
  body: z.string().optional().describe("Optional body content for the event"),
  location: z.string().optional().describe("Location of the event"),
  isAllDay: z.boolean().optional().describe("Whether this is an all-day event"),
  timezone: z.string().optional().describe("Timezone for the event (e.g., 'America/New_York')"),
})

export const DeleteEventSchema = z.object({
  eventId: z.string().describe("The ID of the event to delete"),
})

export const RespondToEventSchema = z.object({
  eventId: z.string().describe("The ID of the event to respond to"),
  response: z.enum(["accept", "decline", "tentativelyAccept"]).describe("Your response to the event"),
  comment: z.string().optional().describe("Optional comment for your response"),
})

// Calendar interfaces
interface CalendarEvent {
  id: string
  subject: string
  bodyPreview?: string
  start: {
    dateTime: string
    timeZone: string
  }
  end: {
    dateTime: string
    timeZone: string
  }
  location?: {
    displayName: string
  }
  organizer?: {
    emailAddress: {
      name: string
      address: string
    }
  }
  attendees?: Array<{
    emailAddress: {
      name: string
      address: string
    }
    status: {
      response: string
      time: string
    }
  }>
  isAllDay: boolean
  isCancelled?: boolean
  importance: string
}

/**
 * List upcoming calendar events
 */
export async function listEvents(accessToken: string, args: z.infer<typeof ListEventsSchema>) {
  const count = Math.min(args.count || 10, 50)

  // Set default time range: now to 30 days from now
  const startTime = args.startTime || new Date().toISOString()
  const defaultEndTime = new Date()
  defaultEndTime.setDate(defaultEndTime.getDate() + 30)
  const endTime = args.endTime || defaultEndTime.toISOString()

  try {
    // Build query parameters
    const queryParams = buildODataQuery({
      select: GRAPH_FIELDS.CALENDAR_EVENT,
      orderBy: "start/dateTime asc",
      top: count,
      filter: `start/dateTime ge '${startTime}' and end/dateTime le '${endTime}'`,
    })

    // Make API call
    const response = await callGraphAPI<GraphAPIResponse<CalendarEvent>>(
      accessToken,
      "GET",
      GRAPH_ENDPOINTS.EVENTS,
      undefined,
      queryParams,
    )

    if (!response.value || response.value.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `No events found between ${new Date(startTime).toLocaleDateString()} and ${new Date(endTime).toLocaleDateString()}.`,
          },
        ],
      }
    }

    // Format response
    const eventList = response.value.map((event) => ({
      id: event.id,
      subject: event.subject || "(No Subject)",
      start: new Date(event.start.dateTime).toLocaleString(),
      end: new Date(event.end.dateTime).toLocaleString(),
      location: event.location?.displayName || "No location",
      organizer: event.organizer?.emailAddress?.name || event.organizer?.emailAddress?.address || "Unknown",
      isAllDay: event.isAllDay,
      isCancelled: event.isCancelled || false,
      importance: event.importance,
      attendeeCount: event.attendees?.length || 0,
      bodyPreview:
        event.bodyPreview?.substring(0, 100) + (event.bodyPreview && event.bodyPreview.length > 100 ? "..." : "") || "",
    }))

    return {
      content: [
        {
          type: "text",
          text: `Found ${eventList.length} upcoming events:\n\n${eventList
            .map(
              (event) =>
                `📅 **${event.subject}**${event.isCancelled ? " ❌ CANCELLED" : ""}\n` +
                `   📍 ${event.location}\n` +
                `   🕐 ${event.isAllDay ? "All day" : `${event.start} - ${event.end}`}\n` +
                `   👤 Organizer: ${event.organizer}\n` +
                `   👥 Attendees: ${event.attendeeCount}\n` +
                `   ${event.importance === "high" ? "❗ High Priority" : ""}\n` +
                (event.bodyPreview ? `   📝 ${event.bodyPreview}\n` : "") +
                `   ID: ${event.id}\n`,
            )
            .join("\n")}`,
        },
      ],
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error listing events: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    }
  }
}

/**
 * Create a new calendar event
 */
export async function createEvent(accessToken: string, args: z.infer<typeof CreateEventSchema>) {
  try {
    // Parse attendees
    const attendees =
      args.attendees?.map((email) => ({
        emailAddress: {
          address: email.trim(),
          name: email.trim(),
        },
        type: "required",
      })) || []

    // Determine timezone (default to UTC if not specified)
    const timezone = args.timezone || "UTC"

    // Build event object
    const event = {
      subject: args.subject,
      body: args.body
        ? {
            contentType: "Text",
            content: args.body,
          }
        : undefined,
      start: {
        dateTime: args.start,
        timeZone: timezone,
      },
      end: {
        dateTime: args.end,
        timeZone: timezone,
      },
      location: args.location
        ? {
            displayName: args.location,
          }
        : undefined,
      attendees: attendees.length > 0 ? attendees : undefined,
      isAllDay: args.isAllDay || false,
    }

    // Make API call
    const response = await callGraphAPI<CalendarEvent>(accessToken, "POST", GRAPH_ENDPOINTS.EVENTS, event)

    return {
      content: [
        {
          type: "text",
          text:
            `✅ Event created successfully!\n\n` +
            `📅 **${response.subject}**\n` +
            `🕐 ${new Date(response.start.dateTime).toLocaleString()} - ${new Date(response.end.dateTime).toLocaleString()}\n` +
            (response.location?.displayName ? `📍 ${response.location.displayName}\n` : "") +
            (attendees.length > 0 ? `👥 Attendees: ${args.attendees?.join(", ")}\n` : "") +
            `🆔 Event ID: ${response.id}`,
        },
      ],
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error creating event: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    }
  }
}

/**
 * Delete a calendar event
 */
export async function deleteEvent(accessToken: string, args: z.infer<typeof DeleteEventSchema>) {
  try {
    await callGraphAPI(accessToken, "DELETE", `me/events/${args.eventId}`)

    return {
      content: [
        {
          type: "text",
          text: `✅ Event deleted successfully (ID: ${args.eventId})`,
        },
      ],
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error deleting event: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    }
  }
}

/**
 * Respond to a calendar event (accept, decline, tentatively accept)
 */
export async function respondToEvent(accessToken: string, args: z.infer<typeof RespondToEventSchema>) {
  try {
    const requestBody = {
      comment: args.comment || "",
      sendResponse: true,
    }

    // Make API call to respond to the event
    await callGraphAPI(accessToken, "POST", `me/events/${args.eventId}/${args.response}`, requestBody)

    const responseText = {
      accept: "accepted",
      decline: "declined",
      tentativelyAccept: "tentatively accepted",
    }[args.response]

    return {
      content: [
        {
          type: "text",
          text: `✅ Event ${responseText} successfully!${args.comment ? `\nComment: "${args.comment}"` : ""}\nEvent ID: ${args.eventId}`,
        },
      ],
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error responding to event: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    }
  }
}

// Export tool definitions
export const CALENDAR_TOOLS = [
  {
    name: "listEvents",
    description: "Lists upcoming events from your Outlook calendar",
    inputSchema: zodToJsonSchema(ListEventsSchema),
    handler: async (args: z.infer<typeof ListEventsSchema>, accessToken: string) => listEvents(accessToken, args),
  },
  {
    name: "createEvent",
    description: "Creates a new calendar event in your Outlook calendar",
    inputSchema: zodToJsonSchema(CreateEventSchema),
    handler: async (args: z.infer<typeof CreateEventSchema>, accessToken: string) => createEvent(accessToken, args),
  },
  {
    name: "deleteEvent",
    description: "Deletes a calendar event from your Outlook calendar",
    inputSchema: zodToJsonSchema(DeleteEventSchema),
    handler: async (args: z.infer<typeof DeleteEventSchema>, accessToken: string) => deleteEvent(accessToken, args),
  },
  {
    name: "respondToEvent",
    description: "Respond to a calendar event invitation (accept, decline, or tentatively accept)",
    inputSchema: zodToJsonSchema(RespondToEventSchema),
    handler: async (args: z.infer<typeof RespondToEventSchema>, accessToken: string) =>
      respondToEvent(accessToken, args),
  },
] as const
