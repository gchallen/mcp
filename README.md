# Geoffrey's Personal MCP Server

A personal Model Context Protocol (MCP) server providing access to personal information and Microsoft Outlook integration through Azure authentication.

## Overview

Geoffrey's Personal MCP Server is a specialized MCP implementation that provides:

- **Personal Tools**: Access to Geoffrey's unmarried name and palindrome creation
- **Microsoft Outlook Integration**: Complete email and calendar functionality through Microsoft Graph API
- **Azure Authentication**: Secure OAuth 2.0 integration with Microsoft Azure
- **Scalable Architecture**: Redis-backed session management for horizontal scaling

This server was originally based on the MCP Everything Server reference implementation and has been customized for personal use with Outlook functionality.

## Features

### Personal Tools

- **Get Unmarried Name**: Returns Geoffrey's unmarried name (Geoffrey Lyle Werner-Allen)
- **Create Palindrome**: Creates palindromes by appending the reverse of input text (e.g., "Gracie" → "GracieeicarG")

### Microsoft Outlook Integration

#### Email Functionality

- **List Emails**: Browse emails from inbox or specific folders
- **Search Emails**: Search emails by sender, subject, content, or other criteria
- **Read Email**: View full email content including attachments and headers
- **Send Email**: Compose and send new emails with support for CC/BCC and attachments
- **Mark as Read/Unread**: Update email read status

#### Calendar Functionality

- **List Events**: View upcoming calendar events with filtering options
- **Create Event**: Schedule new calendar events with attendees and locations
- **Delete Event**: Remove calendar events
- **Respond to Event**: Accept, decline, or tentatively accept meeting invitations

### Technical Features

- **Azure OAuth 2.0**: Complete authentication flow with Microsoft Graph API permissions
- **Streamable HTTP Transport**: Modern MCP transport implementation
- **Session Management**: Redis-backed user isolation and session state
- **Horizontal Scalability**: Multi-instance deployment support
- **Comprehensive Error Handling**: Graceful handling of authentication and API errors

## Installation

### Prerequisites

- Node.js >= 22.0.0
- Redis server
- Azure App Registration with Microsoft Graph API permissions
- npm or yarn

### Setup

```bash
# Clone the repository
git clone <your-repository-url>
cd mcp

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your settings (see Configuration section)
```

### Azure App Registration

To use Outlook functionality, you need to register an app in Azure Portal:

1. **Create App Registration**:
   - Go to [Azure Portal](https://portal.azure.com/) → App registrations
   - Click "New registration"
   - Name: "Geoffrey Personal MCP Server" (or similar)
   - Account types: "Accounts in any organizational directory and personal Microsoft accounts"
   - Redirect URI: `http://localhost:YOUR_PORT/azureauth/callback`

2. **Configure API Permissions**:
   - Go to "API permissions" → "Add a permission" → "Microsoft Graph" → "Delegated permissions"
   - Add these permissions:
     - `offline_access` - For refresh tokens
     - `User.Read` - Basic user profile
     - `Mail.Read` - Read email messages
     - `Mail.Send` - Send email messages
     - `Calendars.Read` - Read calendar events
     - `Calendars.ReadWrite` - Manage calendar events
     - `Contacts.Read` - Read contacts

3. **Create Client Secret**:
   - Go to "Certificates & secrets" → "New client secret"
   - Copy the secret value immediately (you won't be able to see it again)

### Configuration

Environment variables (`.env` file):

```bash
# Server Configuration
PORT=3232
BASE_URI=http://localhost:3232

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Azure OAuth Configuration
AZURE_CLIENT_ID=your-azure-client-id
AZURE_CLIENT_SECRET=your-azure-client-secret
AZURE_AUTHORITY=https://login.microsoftonline.com/common

# User Authorization (optional - leave empty to allow all users)
APPROVED_USERS=your-email@example.com,another-user@example.com
```

## Development

### Commands

```bash
# Start development server with hot reload
npm run dev

# Start development server with debugging
npm run dev:break

# Build TypeScript to JavaScript
npm run build

# Run production server
npm start

# Run linting
npm run lint

# Run tests
npm test

# Run full check (format, lint, typecheck)
npm run check
```

### Project Structure

```
├── src/
│   ├── index.ts                    # Express app setup and routes
│   ├── config.ts                   # Configuration management
│   ├── redis.ts                    # Redis client setup
│   ├── handlers/
│   │   ├── shttp.ts                # Streamable HTTP handler
│   │   ├── azureauth.ts            # Azure OAuth handlers
│   │   └── common.ts               # Shared middleware
│   ├── services/
│   │   ├── mcp.ts                  # Basic MCP server implementation
│   │   ├── mcpWithAuth.ts          # Authenticated MCP server with Outlook
│   │   ├── auth.ts                 # Authentication and session management
│   │   └── redisTransport.ts       # Redis-backed transport
│   ├── tools/
│   │   ├── email.ts                # Email functionality implementation
│   │   └── calendar.ts             # Calendar functionality implementation
│   ├── utils/
│   │   └── graph-api.ts            # Microsoft Graph API utilities
│   └── auth/
│       └── provider.ts             # OAuth provider implementation
├── docs/                           # Documentation
└── dist/                           # Compiled JavaScript output
```

## Usage

### Authentication Flow

1. **User Authentication**: Users authenticate through Azure OAuth
2. **Permission Grant**: Users grant consent for Microsoft Graph API permissions
3. **Token Management**: Access and refresh tokens are managed automatically
4. **Session Creation**: Authenticated sessions provide access to both personal and Outlook tools

### Personal Tools

These tools are available without authentication:

- **getUnmarriedName**: Returns Geoffrey's unmarried name
- **createPalindrome**: Creates palindromes from input text

### Outlook Tools

These tools require Azure authentication:

- **listEmails**: List emails from folders
- **searchEmails**: Search emails with various filters
- **readEmail**: Read full email content
- **sendEmail**: Send new emails
- **markAsRead**: Mark emails as read/unread
- **listEvents**: List calendar events
- **createEvent**: Create new calendar events
- **deleteEvent**: Delete calendar events
- **respondToEvent**: Respond to meeting invitations

## API Endpoints

### MCP Endpoints

- `GET/POST/DELETE /mcp` - Streamable HTTP transport endpoint
  - Handles all MCP protocol communication
  - Supports both authenticated and unauthenticated sessions

### Authentication Endpoints

- `GET /azureauth/authorize` - Azure OAuth authorization
- `GET /azureauth/callback` - OAuth redirect handler
- `GET /azureauth/health` - Azure configuration health check

## Security

### Authentication & Authorization

- **Azure OAuth 2.0**: Complete OAuth flow with PKCE support
- **User Approval**: Optional approved user list for access control
- **Session Isolation**: User sessions are completely isolated
- **Token Management**: Secure handling of access and refresh tokens

### Security Headers

- Content Security Policy (CSP)
- Strict Transport Security (HSTS)
- X-Frame-Options
- X-Content-Type-Options

### Best Practices

1. Use HTTPS in production
2. Configure proper CORS origins
3. Keep Azure client secrets secure
4. Monitor session lifetimes
5. Implement rate limiting
6. Use structured logging

## Testing

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run linting
npm run lint

# Run full check
npm run check
```

The test suite includes:

- Unit tests for core functionality
- Integration tests for Azure authentication
- Redis transport testing
- MCP protocol compliance tests

## Deployment

### Docker Support

```bash
# Build Docker image
npm run docker:build

# Push to registry
npm run docker:push

# Kubernetes deployment
npm run k8s:restart
```

### Environment Setup

1. Configure Azure app registration
2. Set up Redis instance
3. Configure environment variables
4. Deploy with proper HTTPS certificates
5. Set up monitoring and logging

## Troubleshooting

### Common Issues

1. **"Invalid version: me" Error**: Fixed in recent updates - ensure you're using the latest version
2. **Authentication Failed**: Check Azure app registration and permissions
3. **Permission Denied**: Verify user is in APPROVED_USERS list (if configured)
4. **Token Expired**: Re-authenticate through the OAuth flow

### Debug Tools

- Structured JSON logging
- Redis monitoring commands
- Development server with hot reload
- Comprehensive test suite

## Contributing

This is a personal project, but contributions are welcome:

1. Fork the repository
2. Create a feature branch
3. Implement changes with tests
4. Run `npm run check` to ensure quality
5. Submit a pull request

## Acknowledgments

This project builds upon several excellent open-source projects:

- **[ryaker/outlook-mcp](https://github.com/ryaker/outlook-mcp)**: The Outlook MCP functionality was inspired by and adapted from this excellent repository. Special thanks to ryaker for the comprehensive implementation of Microsoft Graph API integration and the modular architecture that served as a reference for this implementation.

- **Model Context Protocol Team**: For the MCP specification and TypeScript SDK

- **Microsoft**: For the Microsoft Graph API and Azure authentication services

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Links

- [Model Context Protocol Documentation](https://modelcontextprotocol.io)
- [MCP Specification](https://modelcontextprotocol.io/specification)
- [Microsoft Graph API Documentation](https://docs.microsoft.com/en-us/graph/)
- [Azure OAuth Documentation](https://docs.microsoft.com/en-us/azure/active-directory/develop/)
- [ryaker/outlook-mcp](https://github.com/ryaker/outlook-mcp) - Original Outlook MCP implementation
