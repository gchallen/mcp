/**
 * Email tools for Microsoft Outlook integration
 */
import { z } from "zod"
import { zodToJsonSchema } from "zod-to-json-schema"
import { callGraphAPI, GRAPH_ENDPOINTS, GRAPH_FIELDS, buildODataQuery, GraphAPIResponse } from "../utils/graph-api.js"

// Input schemas for email tools
export const ListEmailsSchema = z.object({
  folder: z.string().optional().describe("Email folder to list (e.g., 'Inbox', 'Sent', 'Drafts', default: 'Inbox')"),
  count: z.number().min(1).max(50).optional().describe("Number of emails to retrieve (default: 10, max: 50)"),
})

export const SearchEmailsSchema = z.object({
  query: z.string().optional().describe("Search query text to find in emails"),
  folder: z.string().optional().describe("Email folder to search in (default: 'Inbox')"),
  from: z.string().optional().describe("Filter by sender email address or name"),
  subject: z.string().optional().describe("Filter by email subject"),
  hasAttachments: z.boolean().optional().describe("Filter to only emails with attachments"),
  unreadOnly: z.boolean().optional().describe("Filter to only unread emails"),
  count: z.number().min(1).max(50).optional().describe("Number of results to return (default: 10, max: 50)"),
})

export const ReadEmailSchema = z.object({
  id: z.string().describe("ID of the email to read"),
})

export const SendEmailSchema = z.object({
  to: z.string().describe("Comma-separated list of recipient email addresses"),
  cc: z.string().optional().describe("Comma-separated list of CC recipient email addresses"),
  bcc: z.string().optional().describe("Comma-separated list of BCC recipient email addresses"),
  subject: z.string().describe("Email subject"),
  body: z.string().describe("Email body content (can be plain text or HTML)"),
  importance: z.enum(["normal", "high", "low"]).optional().describe("Email importance level"),
  saveToSentItems: z.boolean().optional().describe("Whether to save the email to sent items (default: true)"),
})

export const MarkAsReadSchema = z.object({
  id: z.string().describe("ID of the email to mark as read/unread"),
  isRead: z.boolean().optional().describe("Whether to mark as read (true) or unread (false). Default: true"),
})

// Email interfaces
interface EmailMessage {
  id: string
  subject: string
  from: {
    emailAddress: {
      name: string
      address: string
    }
  }
  toRecipients: Array<{
    emailAddress: {
      name: string
      address: string
    }
  }>
  receivedDateTime: string
  bodyPreview: string
  hasAttachments: boolean
  importance: string
  isRead: boolean
  body?: {
    contentType: string
    content: string
  }
}

/**
 * Get folder ID by name, or return null for inbox
 */
async function getFolderId(accessToken: string, folderName: string): Promise<string | null> {
  if (folderName.toLowerCase() === "inbox") {
    return null // Use default inbox endpoint
  }

  try {
    const response = await callGraphAPI<GraphAPIResponse<{ id: string; displayName: string }>>(
      accessToken,
      "GET",
      GRAPH_ENDPOINTS.MAIL_FOLDERS,
      undefined,
      { $filter: `displayName eq '${folderName}'` },
    )

    return response.value?.[0]?.id || null
  } catch (error) {
    console.error(`Failed to find folder ${folderName}:`, error)
    return null
  }
}

/**
 * List emails from a specific folder
 */
export async function listEmails(accessToken: string, args: z.infer<typeof ListEmailsSchema>) {
  const folder = args.folder || "Inbox"
  const count = Math.min(args.count || 10, 50)

  try {
    // Determine endpoint
    let endpoint: string = GRAPH_ENDPOINTS.MESSAGES
    const folderId = await getFolderId(accessToken, folder)
    if (folderId) {
      endpoint = `me/mailFolders/${folderId}/messages`
    }

    // Build query parameters
    const queryParams = buildODataQuery({
      select: GRAPH_FIELDS.EMAIL_LIST,
      orderBy: "receivedDateTime desc",
      top: count,
    })

    // Make API call
    const response = await callGraphAPI<GraphAPIResponse<EmailMessage>>(
      accessToken,
      "GET",
      endpoint,
      undefined,
      queryParams,
    )

    if (!response.value || response.value.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `No emails found in ${folder}.`,
          },
        ],
      }
    }

    // Format response
    const emailList = response.value.map((email) => ({
      id: email.id,
      subject: email.subject || "(No Subject)",
      from: email.from?.emailAddress?.name || email.from?.emailAddress?.address || "Unknown",
      fromEmail: email.from?.emailAddress?.address || "",
      receivedDateTime: new Date(email.receivedDateTime).toLocaleString(),
      bodyPreview: email.bodyPreview?.substring(0, 100) + (email.bodyPreview?.length > 100 ? "..." : ""),
      hasAttachments: email.hasAttachments,
      importance: email.importance,
      isRead: email.isRead,
    }))

    return {
      content: [
        {
          type: "text",
          text: `Found ${emailList.length} emails in ${folder}:\n\n${emailList
            .map(
              (email) =>
                `📧 **${email.subject}**\n` +
                `   From: ${email.from} (${email.fromEmail})\n` +
                `   Date: ${email.receivedDateTime}\n` +
                `   ${email.isRead ? "✅" : "🔵"} ${email.hasAttachments ? "📎" : ""} ${email.importance === "high" ? "❗" : ""}\n` +
                `   Preview: ${email.bodyPreview}\n` +
                `   ID: ${email.id}\n`,
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
          text: `Error listing emails: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    }
  }
}

/**
 * Search emails with various criteria
 */
export async function searchEmails(accessToken: string, args: z.infer<typeof SearchEmailsSchema>) {
  const folder = args.folder || "Inbox"
  const count = Math.min(args.count || 10, 50)

  try {
    // Build search filters
    const filters: string[] = []

    if (args.from) {
      filters.push(`from/emailAddress/address eq '${args.from}' or from/emailAddress/name eq '${args.from}'`)
    }

    if (args.subject) {
      filters.push(`contains(subject, '${args.subject}')`)
    }

    if (args.hasAttachments) {
      filters.push("hasAttachments eq true")
    }

    if (args.unreadOnly) {
      filters.push("isRead eq false")
    }

    // Determine endpoint
    let endpoint: string = GRAPH_ENDPOINTS.MESSAGES
    const folderId = await getFolderId(accessToken, folder)
    if (folderId) {
      endpoint = `me/mailFolders/${folderId}/messages`
    }

    // Build query parameters
    const queryParams = buildODataQuery({
      select: GRAPH_FIELDS.EMAIL_LIST,
      orderBy: "receivedDateTime desc",
      top: count,
      filter: filters.length > 0 ? filters.join(" and ") : undefined,
    })

    // Add search query if provided
    if (args.query) {
      queryParams.$search = `"${args.query}"`
    }

    // Make API call
    const response = await callGraphAPI<GraphAPIResponse<EmailMessage>>(
      accessToken,
      "GET",
      endpoint,
      undefined,
      queryParams,
    )

    if (!response.value || response.value.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `No emails found matching your search criteria in ${folder}.`,
          },
        ],
      }
    }

    // Format response (same as listEmails)
    const emailList = response.value.map((email) => ({
      id: email.id,
      subject: email.subject || "(No Subject)",
      from: email.from?.emailAddress?.name || email.from?.emailAddress?.address || "Unknown",
      fromEmail: email.from?.emailAddress?.address || "",
      receivedDateTime: new Date(email.receivedDateTime).toLocaleString(),
      bodyPreview: email.bodyPreview?.substring(0, 100) + (email.bodyPreview?.length > 100 ? "..." : ""),
      hasAttachments: email.hasAttachments,
      importance: email.importance,
      isRead: email.isRead,
    }))

    return {
      content: [
        {
          type: "text",
          text: `Found ${emailList.length} emails matching your search:\n\n${emailList
            .map(
              (email) =>
                `📧 **${email.subject}**\n` +
                `   From: ${email.from} (${email.fromEmail})\n` +
                `   Date: ${email.receivedDateTime}\n` +
                `   ${email.isRead ? "✅" : "🔵"} ${email.hasAttachments ? "📎" : ""} ${email.importance === "high" ? "❗" : ""}\n` +
                `   Preview: ${email.bodyPreview}\n` +
                `   ID: ${email.id}\n`,
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
          text: `Error searching emails: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    }
  }
}

/**
 * Read a specific email's content
 */
export async function readEmail(accessToken: string, args: z.infer<typeof ReadEmailSchema>) {
  try {
    const queryParams = buildODataQuery({
      select: GRAPH_FIELDS.EMAIL_DETAIL,
    })

    const response = await callGraphAPI<EmailMessage>(
      accessToken,
      "GET",
      `me/messages/${args.id}`,
      undefined,
      queryParams,
    )

    const email = response
    const bodyContent = email.body?.content || email.bodyPreview || "No content available"

    return {
      content: [
        {
          type: "text",
          text:
            `📧 **${email.subject || "(No Subject)"}**\n\n` +
            `**From:** ${email.from?.emailAddress?.name || "Unknown"} (${email.from?.emailAddress?.address || ""})\n` +
            `**To:** ${email.toRecipients?.map((r) => `${r.emailAddress.name} (${r.emailAddress.address})`).join(", ") || "Unknown"}\n` +
            `**Date:** ${new Date(email.receivedDateTime).toLocaleString()}\n` +
            `**Status:** ${email.isRead ? "Read" : "Unread"} ${email.hasAttachments ? "📎" : ""} ${email.importance === "high" ? "❗ High Priority" : ""}\n\n` +
            `**Content:**\n${bodyContent}`,
        },
      ],
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error reading email: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    }
  }
}

/**
 * Send a new email
 */
export async function sendEmail(accessToken: string, args: z.infer<typeof SendEmailSchema>) {
  try {
    // Parse recipients
    const parseEmails = (emailStr: string) =>
      emailStr.split(",").map((email) => ({
        emailAddress: {
          address: email.trim(),
        },
      }))

    const message = {
      subject: args.subject,
      body: {
        contentType: args.body.includes("<") ? "HTML" : "Text",
        content: args.body,
      },
      toRecipients: parseEmails(args.to),
      ccRecipients: args.cc ? parseEmails(args.cc) : undefined,
      bccRecipients: args.bcc ? parseEmails(args.bcc) : undefined,
      importance: args.importance || "normal",
    }

    const requestBody = {
      message,
      saveToSentItems: args.saveToSentItems !== false,
    }

    await callGraphAPI(accessToken, "POST", GRAPH_ENDPOINTS.SEND_MAIL, requestBody)

    return {
      content: [
        {
          type: "text",
          text: `✅ Email sent successfully to: ${args.to}${args.cc ? ` (CC: ${args.cc})` : ""}${args.bcc ? ` (BCC: ${args.bcc})` : ""}`,
        },
      ],
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error sending email: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    }
  }
}

/**
 * Mark email as read or unread
 */
export async function markAsRead(accessToken: string, args: z.infer<typeof MarkAsReadSchema>) {
  try {
    const isRead = args.isRead !== false // Default to true

    await callGraphAPI(accessToken, "PATCH", `me/messages/${args.id}`, { isRead })

    return {
      content: [
        {
          type: "text",
          text: `✅ Email marked as ${isRead ? "read" : "unread"}`,
        },
      ],
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error marking email: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    }
  }
}

// Export tool definitions
export const EMAIL_TOOLS = [
  {
    name: "listEmails",
    description: "Lists recent emails from your Outlook inbox or specified folder",
    inputSchema: zodToJsonSchema(ListEmailsSchema),
    handler: async (args: z.infer<typeof ListEmailsSchema>, accessToken: string) => listEmails(accessToken, args),
  },
  {
    name: "searchEmails",
    description: "Search for emails using various criteria like sender, subject, or content",
    inputSchema: zodToJsonSchema(SearchEmailsSchema),
    handler: async (args: z.infer<typeof SearchEmailsSchema>, accessToken: string) => searchEmails(accessToken, args),
  },
  {
    name: "readEmail",
    description: "Reads the full content of a specific email",
    inputSchema: zodToJsonSchema(ReadEmailSchema),
    handler: async (args: z.infer<typeof ReadEmailSchema>, accessToken: string) => readEmail(accessToken, args),
  },
  {
    name: "sendEmail",
    description: "Composes and sends a new email",
    inputSchema: zodToJsonSchema(SendEmailSchema),
    handler: async (args: z.infer<typeof SendEmailSchema>, accessToken: string) => sendEmail(accessToken, args),
  },
  {
    name: "markAsRead",
    description: "Marks an email as read or unread",
    inputSchema: zodToJsonSchema(MarkAsReadSchema),
    handler: async (args: z.infer<typeof MarkAsReadSchema>, accessToken: string) => markAsRead(accessToken, args),
  },
] as const
