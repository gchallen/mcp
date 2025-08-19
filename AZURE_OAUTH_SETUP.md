# Azure OAuth Configuration

This document describes how to configure Azure Active Directory (Azure AD) OAuth integration for the MCP server.

## Dynamic OAuth Provider Selection

The system automatically chooses between OAuth providers based on configuration:

- **Azure OAuth** (production): Used when all Azure environment variables are configured
- **Fake OAuth** (development): Used when Azure environment variables are missing

This allows seamless development without requiring Azure AD setup locally.

## Required Environment Variables

Add the following environment variables to your `.env` file or deployment configuration:

```env
# Azure Active Directory OAuth Configuration
AZURE_CLIENT_ID=your-azure-app-client-id
AZURE_CLIENT_SECRET=your-azure-app-client-secret
AZURE_AUTHORITY=https://login.microsoftonline.com/your-tenant-id

# Optional: Set log level for MSAL debugging
LOG_LEVEL=info
```

## Azure AD App Registration Setup

1. **Register a new application in Azure Portal:**
   - Go to [Azure Portal](https://portal.azure.com)
   - Navigate to "Azure Active Directory" > "App registrations"
   - Click "New registration"
   - Enter a name for your application
   - Select appropriate supported account types
   - Set redirect URI to: `https://your-domain.com/azureauth/callback`
   - For development: `http://localhost:3000/azureauth/callback`

2. **Configure application settings:**
   - Record the Application (client) ID
   - Create a client secret under "Certificates & secrets"
   - Note your Tenant ID from the app overview

3. **Set required permissions:**
   - Add Microsoft Graph API permissions:
     - `openid` (sign users in)
     - `profile` (read users' basic profile)
     - `email` (read users' email addresses)

## OAuth Flow

The Azure OAuth integration replaces the fake OAuth provider with real Microsoft authentication:

1. **Authorization Request:** `/azureauth/authorize`
   - Redirects user to Microsoft login
   - Handles OAuth state parameter for security

2. **Authorization Callback:** `/azureauth/callback`
   - Processes Microsoft's authorization response
   - Exchanges authorization code for access token
   - Creates MCP installation with Azure tokens

3. **Health Check:** `/azureauth/health`
   - Verifies Azure OAuth configuration
   - Shows configuration status (without secrets)

## Migration from Fake OAuth

The system now supports both fake OAuth (for testing) and Azure OAuth (for production):

- **Fake OAuth routes:** `/fakeupstreamauth/*` (preserved for testing)
- **Azure OAuth routes:** `/azureauth/*` (new production routes)
- **Default behavior:** Auth provider now redirects to Azure OAuth

## Security Considerations

- Client secrets should be stored securely and never committed to version control
- The MSAL library handles token refresh automatically using internal caching
- Refresh tokens are not exposed directly for security reasons
- Use HTTPS in production for all OAuth endpoints

## Testing

Use the health check endpoint to verify your configuration:

```bash
curl https://your-domain.com/azureauth/health
```

Expected response:

```json
{
  "configured": true,
  "authority": "https://login.microsoftonline.com/your-tenant-id",
  "clientId": "12345678..."
}
```
