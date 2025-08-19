import { Request, Response } from "express"
import {
  ConfidentialClientApplication,
  Configuration,
  AuthorizationUrlRequest,
  AuthorizationCodeRequest,
} from "@azure/msal-node"
import {
  generateMcpTokens,
  readPendingAuthorization,
  saveMcpInstallation,
  saveRefreshToken,
  saveTokenExchange,
} from "../services/auth.js"
import { McpInstallation } from "../types.js"
import { logger } from "../logger.js"
import { BASE_URI } from "../config.js"

// Azure AD configuration
const msalConfig: Configuration = {
  auth: {
    clientId: process.env.AZURE_CLIENT_ID || "",
    clientSecret: process.env.AZURE_CLIENT_SECRET || "",
    authority: process.env.AZURE_AUTHORITY || "https://login.microsoftonline.com/common",
  },
  system: {
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) return
        // Only log warnings and errors to reduce noise
        if (level <= 2) { // Error (0) and Warning (1) levels only
          logger.debug(`MSAL ${level}: ${message}`)
        }
      },
      piiLoggingEnabled: false,
      logLevel: process.env.NODE_ENV === "production" ? 3 : 2, // Error in production, Warning in dev
    },
  },
}

// Initialize MSAL instance
const msalInstance = new ConfidentialClientApplication(msalConfig)

/**
 * Handles the initial authorization request - redirects user to Azure AD
 */
export async function handleAzureAuthorize(req: Request, res: Response) {
  const { redirect_uri, state } = req.query

  try {
    // Use BASE_URI to construct absolute redirect URI for Azure AD
    const redirectUri = (redirect_uri as string).startsWith("http")
      ? (redirect_uri as string)
      : `${BASE_URI}${redirect_uri}`

    logger.info("Azure OAuth authorization request", {
      redirectUri: redirectUri,
    })

    // Build the authorization URL request - use our server's callback for token exchange
    const authUrlRequest: AuthorizationUrlRequest = {
      scopes: ["openid", "profile", "email"],
      redirectUri: redirectUri, // Our server's callback: http://localhost:XXXX/azureauth/callback
      state: state as string,
    }

    // Get the authorization URL from Azure AD
    const authUrl = await msalInstance.getAuthCodeUrl(authUrlRequest)

    // Redirect user to Azure AD for authentication
    res.redirect(authUrl)
  } catch (error) {
    logger.error("Error generating Azure AD authorization URL:", error)
    res.status(500).send("Error initiating Azure AD authentication")
  }
}

/**
 * Handles the callback from Azure AD after user authorization
 */
export async function handleAzureAuthorizeRedirect(req: Request, res: Response) {
  const {
    // The state returned from Azure AD is actually the MCP authorization code
    state: mcpAuthorizationCode,
    code: azureAuthorizationCode,
    error,
    error_description,
  } = req.query

  logger.info("Azure OAuth callback received")

  try {
    // Check for Azure AD errors
    if (error) {
      logger.error("Azure AD authentication error:", { error, error_description })
      res.status(400).send(`Authentication failed: ${error_description || error}`)
      return
    }

    // Validate required parameters
    if (typeof mcpAuthorizationCode !== "string" || typeof azureAuthorizationCode !== "string") {
      throw new Error("Invalid authorization code parameters")
    }

    // Get the pending authorization from our store
    const pendingAuth = await readPendingAuthorization(mcpAuthorizationCode)
    if (!pendingAuth) {
      throw new Error("No matching authorization found")
    }

    // Exchange the Azure authorization code for tokens
    // Must use the SAME redirect URI that was used for authorization (our server's callback)
    const authorizationRedirectUri = `/azureauth/callback`
    const absoluteAuthRedirectUri = `${BASE_URI}${authorizationRedirectUri}`

    const tokenRequest: AuthorizationCodeRequest = {
      code: azureAuthorizationCode,
      scopes: ["openid", "profile", "email"],
      redirectUri: absoluteAuthRedirectUri, // Same URI used for authorization
    }

    logger.debug("Azure OAuth token exchange initiated")

    const tokenResponse = await msalInstance.acquireTokenByCode(tokenRequest)

    if (!tokenResponse) {
      throw new Error("Failed to acquire token from Azure AD")
    }

    // Extract user information from the ID token
    const userId = tokenResponse.account?.homeAccountId || tokenResponse.account?.localAccountId || "unknown-user"

    // Generate MCP tokens
    const mcpTokens = generateMcpTokens()

    // Create the MCP installation with Azure tokens
    const mcpInstallation: McpInstallation = {
      azureInstallation: {
        accessToken: tokenResponse.accessToken,
        idToken: tokenResponse.idToken || undefined,
        account: tokenResponse.account,
        expiresOn: tokenResponse.expiresOn || undefined,
      },
      mcpTokens,
      clientId: pendingAuth.clientId,
      issuedAt: Date.now() / 1000,
      userId,
    }

    // Store the MCP installation
    await saveMcpInstallation(mcpTokens.access_token, mcpInstallation)

    // Store the refresh token mapping if available
    if (mcpTokens.refresh_token) {
      await saveRefreshToken(mcpTokens.refresh_token, mcpTokens.access_token)
    }

    // Store the token exchange data
    await saveTokenExchange(mcpAuthorizationCode, {
      mcpAccessToken: mcpTokens.access_token,
      alreadyUsed: false,
    })

    // Redirect back to the original application with the authorization code and state
    const redirectUrl = pendingAuth.state
      ? `${pendingAuth.redirectUri}?code=${mcpAuthorizationCode}&state=${pendingAuth.state}`
      : `${pendingAuth.redirectUri}?code=${mcpAuthorizationCode}`

    res.redirect(redirectUrl)
  } catch (error) {
    logger.error("Error processing Azure AD callback:", error)
    res.status(500).send("Error processing authentication callback")
  }
}

/**
 * Health check endpoint for Azure AD configuration
 */
export async function handleAzureHealthCheck(req: Request, res: Response) {
  const isConfigured = !!(process.env.AZURE_CLIENT_ID && process.env.AZURE_CLIENT_SECRET && process.env.AZURE_AUTHORITY)

  res.json({
    configured: isConfigured,
    authority: msalConfig.auth.authority,
    clientId: msalConfig.auth.clientId ? `${msalConfig.auth.clientId.substring(0, 8)}...` : "not set",
  })
}
