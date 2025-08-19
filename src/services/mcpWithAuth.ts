/**
 * MCP Server with Azure authentication integration for Outlook tools
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { CallToolRequestSchema, ListToolsRequestSchema, Tool } from "@modelcontextprotocol/sdk/types.js"
import { z } from "zod"
import { zodToJsonSchema } from "zod-to-json-schema"
import { EMAIL_TOOLS } from "../tools/email.js"
import { CALENDAR_TOOLS } from "../tools/calendar.js"
import { readMcpInstallation } from "./auth.js"
import { logger } from "../logger.js"

type ToolInput = {
  type: "object"
  properties?: Record<string, unknown>
  required?: string[]
}

/* Input schemas for personal tools */
const GetUnmarriedNameSchema = z.object({})

const CreatePalindromeSchema = z.object({
  text: z.string().describe("Text to convert into a palindrome"),
})

enum PersonalToolName {
  GET_UNMARRIED_NAME = "getUnmarriedName",
  CREATE_PALINDROME = "createPalindrome",
}

interface McpServerWrapper {
  server: Server
  cleanup: () => void
}

/**
 * Creates an MCP server with Azure authentication support for Outlook tools
 * @param mcpAccessToken - The MCP access token to retrieve Azure credentials
 */
export const createMcpServerWithAuth = (mcpAccessToken?: string): McpServerWrapper => {
  const server = new Server(
    {
      name: "geoffrey-personal-mcp",
      version: "2025.8.0",
    },
    {
      capabilities: {
        tools: {},
      },
    },
  )

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const personalTools: Tool[] = [
      {
        name: PersonalToolName.GET_UNMARRIED_NAME,
        description: "Returns Geoffrey's unmarried name",
        inputSchema: zodToJsonSchema(GetUnmarriedNameSchema) as ToolInput,
      },
      {
        name: PersonalToolName.CREATE_PALINDROME,
        description: "Creates a palindrome by appending the reverse of the input text",
        inputSchema: zodToJsonSchema(CreatePalindromeSchema) as ToolInput,
      },
    ]

    // Add Outlook email and calendar tools
    const emailTools: Tool[] = EMAIL_TOOLS.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema as ToolInput,
    }))

    const calendarTools: Tool[] = CALENDAR_TOOLS.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema as ToolInput,
    }))

    const tools = [...personalTools, ...emailTools, ...calendarTools]
    return { tools }
  })

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params

    try {
      // Handle personal tools (no authentication required)
      if (name === PersonalToolName.GET_UNMARRIED_NAME) {
        GetUnmarriedNameSchema.parse(args)
        return {
          content: [
            {
              type: "text",
              text: "Geoffrey Lyle Werner-Allen",
            },
          ],
        }
      }

      if (name === PersonalToolName.CREATE_PALINDROME) {
        const validatedArgs = CreatePalindromeSchema.parse(args)
        const { text } = validatedArgs

        // Create palindrome by appending the reverse
        const reversed = text.split("").reverse().join("")
        const palindrome = text + reversed

        return {
          content: [
            {
              type: "text",
              text: palindrome,
            },
          ],
        }
      }

      // Handle Outlook tools (require authentication)
      const outlookTools = [...EMAIL_TOOLS, ...CALENDAR_TOOLS]
      const outlookTool = outlookTools.find((tool) => tool.name === name)

      if (outlookTool) {
        // Get Azure access token from MCP installation
        if (!mcpAccessToken) {
          return {
            content: [
              {
                type: "text",
                text: "❌ Authentication required. No MCP access token available.",
              },
            ],
          }
        }

        const mcpInstallation = await readMcpInstallation(mcpAccessToken)
        if (!mcpInstallation?.azureInstallation?.accessToken) {
          return {
            content: [
              {
                type: "text",
                text:
                  "❌ Azure authentication required. Please ensure your Azure app has the following permissions:\n" +
                  "- Mail.Read\n" +
                  "- Mail.ReadWrite\n" +
                  "- Mail.Send\n" +
                  "- Calendars.Read\n" +
                  "- Calendars.ReadWrite\n" +
                  "- User.Read\n\n" +
                  "Please complete the Azure OAuth flow to access Outlook features.",
              },
            ],
          }
        }

        // Check if token is expired
        if (mcpInstallation.azureInstallation.expiresOn && mcpInstallation.azureInstallation.expiresOn < new Date()) {
          return {
            content: [
              {
                type: "text",
                text: "❌ Azure access token has expired. Please re-authenticate to access Outlook features.",
              },
            ],
          }
        }

        // Call the Outlook tool with the Azure access token
        const azureAccessToken = mcpInstallation.azureInstallation.accessToken

        logger.info("Calling Outlook tool", {
          toolName: name,
          userEmail: mcpInstallation.azureInstallation.userEmail,
        })

        try {
          return await outlookTool.handler(args as never, azureAccessToken)
        } catch (error) {
          logger.error("Error calling Outlook tool", {
            toolName: name,
            error: error instanceof Error ? error.message : String(error),
          })

          // Handle specific Microsoft Graph API errors
          if (error instanceof Error) {
            if (error.message.includes("UNAUTHORIZED")) {
              return {
                content: [
                  {
                    type: "text",
                    text: "❌ Azure access token is invalid or expired. Please re-authenticate to access Outlook features.",
                  },
                ],
              }
            }

            if (error.message.includes("Forbidden") || error.message.includes("403")) {
              return {
                content: [
                  {
                    type: "text",
                    text: "❌ Insufficient permissions to access this Outlook feature. Please ensure your Azure app has the required permissions and that an admin has granted consent.",
                  },
                ],
              }
            }
          }

          return {
            content: [
              {
                type: "text",
                text: `❌ Error executing Outlook tool: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
          }
        }
      }

      throw new Error(`Unknown tool: ${name}`)
    } catch (error) {
      logger.error("Error in tool call handler", {
        toolName: name,
        error: error instanceof Error ? error.message : String(error),
      })

      return {
        content: [
          {
            type: "text",
            text: `❌ Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      }
    }
  })

  const cleanup = async () => {
    // No intervals to clean up in simplified version
  }

  return { server, cleanup }
}
