import { AsyncLocalStorage } from "async_hooks"
import { Request, Response, NextFunction } from "express"

// Severity levels as per Google Cloud Logging
export enum LogSeverity {
  DEFAULT = "DEFAULT",
  DEBUG = "DEBUG",
  INFO = "INFO",
  NOTICE = "NOTICE",
  WARNING = "WARNING",
  ERROR = "ERROR",
  CRITICAL = "CRITICAL",
  ALERT = "ALERT",
  EMERGENCY = "EMERGENCY",
}

// Numeric severity levels for comparison
const SEVERITY_LEVELS: Record<LogSeverity, number> = {
  [LogSeverity.DEFAULT]: 0,
  [LogSeverity.DEBUG]: 100,
  [LogSeverity.INFO]: 200,
  [LogSeverity.NOTICE]: 300,
  [LogSeverity.WARNING]: 400,
  [LogSeverity.ERROR]: 500,
  [LogSeverity.CRITICAL]: 600,
  [LogSeverity.ALERT]: 700,
  [LogSeverity.EMERGENCY]: 800,
}

interface LogContext {
  trace?: string
  spanId?: string
  requestId?: string
  userAgent?: string
  method?: string
  path?: string
  [key: string]: string | undefined
}

interface StructuredLogEntry {
  severity: LogSeverity
  message: string
  timestamp: string
  "logging.googleapis.com/trace"?: string
  "logging.googleapis.com/spanId"?: string
  [key: string]: unknown
}

class StructuredLogger {
  private asyncLocalStorage = new AsyncLocalStorage<LogContext>()
  private projectId: string | undefined
  private minSeverity: LogSeverity

  constructor() {
    // Get project ID from environment or metadata server
    this.projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT

    // Set minimum log level based on environment
    this.minSeverity = this.getMinSeverity()
  }

  private getMinSeverity(): LogSeverity {
    // Check LOG_LEVEL environment variable first
    const logLevel = process.env.LOG_LEVEL?.toUpperCase()
    if (logLevel && logLevel in LogSeverity) {
      return LogSeverity[logLevel as keyof typeof LogSeverity]
    }

    // Set default based on NODE_ENV
    const nodeEnv = process.env.NODE_ENV
    if (nodeEnv === "test") {
      return LogSeverity.ERROR // Only show errors and above in tests
    } else if (nodeEnv === "production") {
      return LogSeverity.INFO // Show info and above in production
    } else {
      return LogSeverity.DEBUG // Show everything in development
    }
  }

  /**
   * Run a function with a specific logging context
   */
  runWithContext<T>(context: LogContext, fn: () => T): T {
    return this.asyncLocalStorage.run(context, fn)
  }

  /**
   * Extract trace context from Cloud Run request
   */
  extractTraceContext(req: Request): LogContext {
    const context: LogContext = {}

    const traceHeader = req.header("X-Cloud-Trace-Context")
    if (traceHeader && this.projectId) {
      const [trace, spanId] = traceHeader.split("/")
      context.trace = `projects/${this.projectId}/traces/${trace}`
      if (spanId) {
        context.spanId = spanId.split(";")[0] // Remove any trace flags
      }
    }

    // Add other useful request context
    context.requestId = req.header("X-Request-Id")
    context.userAgent = req.header("User-Agent")
    context.method = req.method
    context.path = req.path

    return context
  }

  /**
   * Create Express middleware for request context
   */
  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const context = this.extractTraceContext(req)
      this.runWithContext(context, () => {
        next()
      })
    }
  }

  /**
   * Log a structured message
   */
  private log(severity: LogSeverity, message: string, metadata?: Record<string, unknown>) {
    // Check if this log level should be output
    if (SEVERITY_LEVELS[severity] < SEVERITY_LEVELS[this.minSeverity]) {
      return // Skip logs below minimum severity
    }

    const context = this.asyncLocalStorage.getStore() || {}

    const entry: StructuredLogEntry = {
      severity,
      message,
      timestamp: new Date().toISOString(),
      ...metadata,
    }

    // Add trace context if available
    if (context.trace) {
      entry["logging.googleapis.com/trace"] = context.trace
    }
    if (context.spanId) {
      entry["logging.googleapis.com/spanId"] = context.spanId
    }

    // Add any other context fields
    Object.keys(context).forEach((key) => {
      if (key !== "trace" && key !== "spanId") {
        entry[`context.${key}`] = context[key]
      }
    })

    // Output as JSON for Cloud Logging
    console.log(JSON.stringify(entry))
  }

  // Convenience methods for different severity levels
  debug(message: string, metadata?: Record<string, unknown>) {
    this.log(LogSeverity.DEBUG, message, metadata)
  }

  info(message: string, metadata?: Record<string, unknown>) {
    this.log(LogSeverity.INFO, message, metadata)
  }

  notice(message: string, metadata?: Record<string, unknown>) {
    this.log(LogSeverity.NOTICE, message, metadata)
  }

  warning(message: string, metadata?: Record<string, unknown>) {
    this.log(LogSeverity.WARNING, message, metadata)
  }

  error(message: string, error?: Error, metadata?: Record<string, unknown>) {
    const errorMetadata = {
      ...metadata,
      error: error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
          }
        : undefined,
    }
    this.log(LogSeverity.ERROR, message, errorMetadata)
  }

  critical(message: string, metadata?: Record<string, unknown>) {
    this.log(LogSeverity.CRITICAL, message, metadata)
  }

  alert(message: string, metadata?: Record<string, unknown>) {
    this.log(LogSeverity.ALERT, message, metadata)
  }

  emergency(message: string, metadata?: Record<string, unknown>) {
    this.log(LogSeverity.EMERGENCY, message, metadata)
  }

  /**
   * Add additional context to the current async context
   */
  addContext(context: LogContext) {
    const currentContext = this.asyncLocalStorage.getStore()
    if (currentContext) {
      Object.assign(currentContext, context)
    }
  }
}

// Export singleton instance
export const logger = new StructuredLogger()

// Re-export for convenience
export type { LogContext, StructuredLogEntry }
