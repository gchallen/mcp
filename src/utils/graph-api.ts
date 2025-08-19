/**
 * Microsoft Graph API utility functions
 * Integrates with existing Azure authentication
 */

/**
 * Configuration for Microsoft Graph API calls
 */
export interface GraphAPIConfig {
  baseUrl: string
  defaultHeaders: Record<string, string>
}

export const GRAPH_CONFIG: GraphAPIConfig = {
  baseUrl: "https://graph.microsoft.com/v1.0",
  defaultHeaders: {
    "Content-Type": "application/json",
  },
}

/**
 * Microsoft Graph API response interface
 */
export interface GraphAPIResponse<T = unknown> {
  value?: T[]
  "@odata.count"?: number
  "@odata.nextLink"?: string
  error?: {
    code: string
    message: string
  }
}

/**
 * Makes a request to Microsoft Graph API
 * @param accessToken - OAuth access token
 * @param method - HTTP method
 * @param endpoint - API endpoint path (relative to base URL)
 * @param data - Request body data
 * @param queryParams - URL query parameters
 * @returns Promise with API response
 */
export async function callGraphAPI<T = unknown>(
  accessToken: string,
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
  endpoint: string,
  data?: unknown,
  queryParams?: Record<string, string | number | boolean>,
): Promise<T> {
  try {
    // Build URL with query parameters
    const url = new URL(endpoint, GRAPH_CONFIG.baseUrl)
    if (queryParams) {
      Object.entries(queryParams).forEach(([key, value]) => {
        url.searchParams.append(key, String(value))
      })
    }

    // Prepare headers
    const headers: Record<string, string> = {
      ...GRAPH_CONFIG.defaultHeaders,
      Authorization: `Bearer ${accessToken}`,
    }

    // Prepare fetch options
    const options: RequestInit = {
      method,
      headers,
    }

    // Add body for POST/PATCH/PUT requests
    if (data && ["POST", "PATCH", "PUT"].includes(method)) {
      options.body = JSON.stringify(data)
    }

    // Make the request
    const response = await fetch(url.toString(), options)

    // Handle response
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("UNAUTHORIZED: Token expired or invalid")
      }

      let errorMessage = `HTTP ${response.status}: ${response.statusText}`
      try {
        const errorData = await response.json()
        if (errorData.error?.message) {
          errorMessage = errorData.error.message
        }
      } catch {
        // If we can't parse error JSON, use the status text
      }

      throw new Error(`Microsoft Graph API error: ${errorMessage}`)
    }

    // Handle empty responses (like DELETE operations)
    if (response.status === 204) {
      return {} as T
    }

    // Parse JSON response
    const result = await response.json()
    return result as T
  } catch (error) {
    if (error instanceof Error) {
      throw error
    }
    throw new Error(`Microsoft Graph API call failed: ${String(error)}`)
  }
}

/**
 * Constants for common Graph API endpoints and field selections
 */
export const GRAPH_ENDPOINTS = {
  // Email endpoints
  MESSAGES: "me/messages",
  SEND_MAIL: "me/sendMail",
  MAIL_FOLDERS: "me/mailFolders",

  // Calendar endpoints
  EVENTS: "me/events",
  CALENDAR: "me/calendar",
  CALENDARS: "me/calendars",

  // User endpoints
  USER_PROFILE: "me",
} as const

/**
 * Field selections for different Graph API resources
 */
export const GRAPH_FIELDS = {
  EMAIL_LIST: "id,subject,from,toRecipients,ccRecipients,receivedDateTime,bodyPreview,hasAttachments,importance,isRead",
  EMAIL_DETAIL:
    "id,subject,from,toRecipients,ccRecipients,bccRecipients,receivedDateTime,bodyPreview,body,hasAttachments,importance,isRead,internetMessageHeaders",
  CALENDAR_EVENT: "id,subject,bodyPreview,start,end,location,organizer,attendees,isAllDay,isCancelled,importance",
  USER_BASIC: "id,displayName,userPrincipalName,mail",
} as const

/**
 * Helper function to build OData query parameters
 */
export function buildODataQuery(options: {
  select?: string
  filter?: string
  orderBy?: string
  top?: number
  skip?: number
}): Record<string, string | number> {
  const params: Record<string, string | number> = {}

  if (options.select) params.$select = options.select
  if (options.filter) params.$filter = options.filter
  if (options.orderBy) params.$orderby = options.orderBy
  if (options.top) params.$top = options.top
  if (options.skip) params.$skip = options.skip

  return params
}
