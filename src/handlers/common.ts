import { NextFunction, Request, Response } from "express"
import { withContext } from "../context.js"
import { readMcpInstallation } from "../services/auth.js"
import { logger } from "../logger.js"
import { APPROVED_USERS } from "../config.js"

import { JSONRPCError, JSONRPCNotification, JSONRPCRequest, JSONRPCResponse } from "@modelcontextprotocol/sdk/types.js"

export function logMcpMessage(
  message: JSONRPCError | JSONRPCNotification | JSONRPCRequest | JSONRPCResponse,
  sessionId: string,
) {
  // check if message has a method field
  if ("method" in message) {
    if (message.method === "tools/call") {
      logger.info("Processing MCP method", {
        sessionId,
        method: message.method,
        toolName: message.params?.name,
      })
    } else {
      logger.info("Processing MCP method", {
        sessionId,
        method: message.method,
      })
    }
  } else if ("error" in message) {
    logger.warn("Received error message", {
      sessionId,
      errorMessage: message.error.message,
      errorCode: message.error.code,
    })
  }
}

export async function authContext(req: Request, res: Response, next: NextFunction) {
  const authInfo = req.auth

  if (!authInfo) {
    res.set("WWW-Authenticate", 'Bearer error="invalid_token"')
    res.status(401).json({ error: "Invalid access token" })
    return
  }

  const token = authInfo.token

  // Load UpstreamInstallation based on the access token
  const mcpInstallation = await readMcpInstallation(token)
  if (!mcpInstallation) {
    res.set("WWW-Authenticate", 'Bearer error="invalid_token"')
    res.status(401).json({ error: "Invalid access token" })
    return
  }

  // Wrap the rest of the request handling in the context
  withContext(
    {
      mcpAccessToken: token,
      fakeUpstreamInstallation: mcpInstallation.fakeUpstreamInstallation || {
        fakeAccessTokenForDemonstration: "",
        fakeRefreshTokenForDemonstration: "",
      },
    },
    () => next(),
  )
}

/**
 * Middleware to check if the user is authorized for MCP operations
 * Only enforced for Azure OAuth users when APPROVED_USERS is configured
 */
export async function userAuthorization(req: Request, res: Response, next: NextFunction) {
  // Skip authorization if no approved users list is configured
  if (APPROVED_USERS.length === 0) {
    next()
    return
  }

  const token = req.headers.authorization?.replace("Bearer ", "")
  if (!token) {
    res.set("WWW-Authenticate", 'Bearer error="invalid_token"')
    res.status(401).json({ error: "Authorization header required" })
    return
  }

  const mcpInstallation = await readMcpInstallation(token)
  if (!mcpInstallation) {
    res.set("WWW-Authenticate", 'Bearer error="invalid_token"')
    res.status(401).json({ error: "Invalid access token" })
    return
  }

  // Only check user authorization for Azure OAuth installations
  if (mcpInstallation.azureInstallation) {
    const userEmail = mcpInstallation.azureInstallation.userEmail
    if (!userEmail) {
      logger.error("Azure installation missing user email")
      res.status(403).json({ error: "User email not available" })
      return
    }

    if (!APPROVED_USERS.includes(userEmail.toLowerCase())) {
      logger.warn("Unauthorized user attempted MCP access", { email: userEmail })
      res.status(403).json({ error: "Access denied: user not approved for this MCP server" })
      return
    }
  }
  
  // User is authorized, continue to next middleware
  next()
}
