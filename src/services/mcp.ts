import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { CallToolRequestSchema, ListToolsRequestSchema, Tool } from "@modelcontextprotocol/sdk/types.js"
import { z } from "zod"
import { zodToJsonSchema } from "zod-to-json-schema"

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
    const tools: Tool[] = [
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

    return { tools }
  })

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params

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

    throw new Error(`Unknown tool: ${name}`)
  })

  const cleanup = async () => {
    // No intervals to clean up in simplified version
  }

  return { server, cleanup }
}
