import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { CallToolRequestSchema, ListToolsRequestSchema, Tool } from "@modelcontextprotocol/sdk/types.js"
import { z } from "zod"
import { zodToJsonSchema } from "zod-to-json-schema"
import { EMAIL_TOOLS } from "../tools/email.js"
import { CALENDAR_TOOLS } from "../tools/calendar.js"

type ToolInput = {
  type: "object"
  properties?: Record<string, unknown>
  required?: string[]
}

/* Input schemas for tools implemented in this server */
const GetUnmarriedNameSchema = z.object({})

const CreatePalindromeSchema = z.object({
  text: z.string().describe("Text to convert into a palindrome"),
})

enum ToolName {
  GET_UNMARRIED_NAME = "getUnmarriedName",
  CREATE_PALINDROME = "createPalindrome",
}

interface McpServerWrapper {
  server: Server
  cleanup: () => void
}

export const createMcpServer = (): McpServerWrapper => {
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
        name: ToolName.GET_UNMARRIED_NAME,
        description: "Returns Geoffrey's unmarried name",
        inputSchema: zodToJsonSchema(GetUnmarriedNameSchema) as ToolInput,
      },
      {
        name: ToolName.CREATE_PALINDROME,
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

    // Handle personal tools (no authentication required)
    if (name === ToolName.GET_UNMARRIED_NAME) {
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

    if (name === ToolName.CREATE_PALINDROME) {
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
    // Note: In a real MCP environment, authentication context would be available
    // For now, we'll return an error indicating authentication is needed
    const outlookTools = [...EMAIL_TOOLS, ...CALENDAR_TOOLS]
    const outlookTool = outlookTools.find((tool) => tool.name === name)

    if (outlookTool) {
      return {
        content: [
          {
            type: "text",
            text:
              "❌ Microsoft Outlook tools require Azure authentication with appropriate scopes. Please ensure your Azure app has the following permissions:\n" +
              "- Mail.Read\n" +
              "- Mail.ReadWrite  \n" +
              "- Mail.Send\n" +
              "- Calendars.Read\n" +
              "- Calendars.ReadWrite\n" +
              "- User.Read\n\n" +
              "Once configured, the authentication will be handled through the existing Azure OAuth flow.",
          },
        ],
      }
    }

    throw new Error(`Unknown tool: ${name}`)
  })

  const cleanup = async () => {
    // No intervals to clean up in simplified version
  }

  return { server, cleanup }
}
