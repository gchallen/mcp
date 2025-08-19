import { jest } from "@jest/globals"
import { Request, Response, NextFunction } from "express"
import { userAuthorization } from "./common.js"
import { readMcpInstallation, saveMcpInstallation, generateMcpTokens } from "../services/auth.js"
import { McpInstallation } from "../types.js"
import { setRedisClient, MockRedisClient } from "../redis.js"

describe("userAuthorization middleware", () => {
  let req: Partial<Request>
  let res: Partial<Response>
  let next: NextFunction
  let mockRedis: MockRedisClient

  beforeEach(() => {
    jest.resetAllMocks()

    mockRedis = new MockRedisClient()
    setRedisClient(mockRedis)

    req = {
      headers: {
        authorization: "Bearer test-token",
      },
    }

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),  
      set: jest.fn().mockReturnThis(),
    } as unknown as Response

    next = jest.fn()
  })

  it("should allow access when no APPROVED_USERS is configured (test environment)", async () => {
    // In test environment, APPROVED_USERS is empty, so all requests should pass through
    req.headers!.authorization = undefined

    await userAuthorization(req as Request, res as Response, next)

    expect(next).toHaveBeenCalled()
    expect(res.status).not.toHaveBeenCalled()
  })

  it("should allow access for fake OAuth installations", async () => {
    const mcpTokens = generateMcpTokens()
    const mcpInstallation: McpInstallation = {
      fakeUpstreamInstallation: {
        fakeAccessTokenForDemonstration: "fake-token",
        fakeRefreshTokenForDemonstration: "fake-refresh",
      },
      mcpTokens,
      clientId: "test-client",
      issuedAt: Date.now() / 1000,
      userId: "test-user",
    }

    await saveMcpInstallation(mcpTokens.access_token, mcpInstallation)
    req.headers!.authorization = `Bearer ${mcpTokens.access_token}`

    await userAuthorization(req as Request, res as Response, next)

    expect(next).toHaveBeenCalled()
    expect(res.status).not.toHaveBeenCalled()
  })

  it("should allow access for Azure OAuth installations when no APPROVED_USERS", async () => {
    const mcpTokens = generateMcpTokens()
    const mcpInstallation: McpInstallation = {
      azureInstallation: {
        accessToken: "azure-token",
        userEmail: "test@example.com",
        account: null,
      },
      mcpTokens,
      clientId: "test-client",
      issuedAt: Date.now() / 1000,
      userId: "test-user",
    }

    await saveMcpInstallation(mcpTokens.access_token, mcpInstallation)
    req.headers!.authorization = `Bearer ${mcpTokens.access_token}`

    await userAuthorization(req as Request, res as Response, next)

    // Since APPROVED_USERS is empty in test environment, should allow access
    expect(next).toHaveBeenCalled()
    expect(res.status).not.toHaveBeenCalled()
  })

  // Note: To test user authorization blocking behavior, you would need to:
  // 1. Set APPROVED_USERS environment variable before running tests
  // 2. Or create a separate test suite that mocks the config module
  // For example: APPROVED_USERS=approved@test.com npm test
})