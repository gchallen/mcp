import { OAuthTokens } from "@modelcontextprotocol/sdk/shared/auth.js"
import { AccountInfo } from "@azure/msal-node"

// authorization code -> PendingAuthorization
export interface PendingAuthorization {
  redirectUri: string
  codeChallenge: string
  codeChallengeMethod: string
  clientId: string
  state?: string
}

// authorization code -> MCP access token (once authorized)
export interface TokenExchange {
  mcpAccessToken: string
  alreadyUsed: boolean
}

export interface FakeUpstreamInstallation {
  fakeAccessTokenForDemonstration: string
  fakeRefreshTokenForDemonstration: string
}

export interface AzureInstallation {
  accessToken: string
  idToken?: string
  account: AccountInfo | null
  expiresOn?: Date
  userEmail?: string
}

// This is the object stored in Redis holding the upstream "Installation" + all the relevant MCP tokens
// It is stored encrypted by the MCP access token
export interface McpInstallation {
  fakeUpstreamInstallation?: FakeUpstreamInstallation
  azureInstallation?: AzureInstallation
  mcpTokens: OAuthTokens
  clientId: string
  issuedAt: number
  userId: string // Unique identifier for the user (not client)
}
