Always build, lint, and test your changes.

# Geoffrey's Personal MCP Server

This is Geoffrey's personal MCP (Model Context Protocol) server that provides both personal tools and Microsoft Outlook integration.

## Key Project Information

**Personal Tools** (no authentication required):

- `getUnmarriedName`: Returns "Geoffrey Lyle Werner-Allen"
- `createPalindrome`: Creates palindromes by appending reversed text (e.g., "Gracie" → "GracieeicarG")

**Microsoft Outlook Tools** (require Azure authentication):

- Email: list, search, read, send, mark as read/unread
- Calendar: list events, create events, delete events, respond to invitations
- Integration via Microsoft Graph API with Azure OAuth 2.0

## Development Workflow

**Always run the full check before committing:**

```bash
npm run check  # Runs format, lint, and typecheck
```

**Build and test commands:**

```bash
npm run build    # TypeScript compilation
npm test         # Jest test suite
npm run lint     # ESLint checking
npm run dev      # Development server with hot reload
```

## Architecture

- **Dual MCP Servers**: Basic server (personal tools) and authenticated server (personal + Outlook tools)
- **Authentication**: Azure OAuth 2.0 with Microsoft Graph API permissions
- **Transport**: Streamable HTTP with Redis session management
- **Scaling**: Horizontally scalable with Redis-backed state

## Important Implementation Details

**Microsoft Graph API**: Uses proper scope names (not full URLs):

- `User.Read`, `Mail.Read`, `Mail.Send`, `Calendars.Read`, `Calendars.ReadWrite`, `Contacts.Read`, `offline_access`

**Session Management**: Authenticated sessions automatically select the enhanced server with Outlook tools, while unauthenticated sessions use the basic server with helpful error messages for Outlook tool requests.

**Tool Validation**: All tools use Zod schemas for input validation and proper TypeScript typing throughout.

## Testing

The Jest configuration excludes the `outlook-mcp/` reference directory from test runs. All project tests should pass:

- Unit tests for core functionality
- Integration tests for authentication flows
- Redis transport tests
- MCP protocol compliance tests

## Acknowledgments

Outlook functionality adapted from [ryaker/outlook-mcp](https://github.com/ryaker/outlook-mcp) repository.
