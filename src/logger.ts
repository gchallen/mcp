import log4js from "log4js"

// Configure log4js based on environment
const logLevel = process.env.LOG_LEVEL?.toLowerCase() || (process.env.NODE_ENV === "test" ? "error" : "info")
const useJsonLayout = process.env.NODE_ENV === "production"

log4js.configure({
  appenders: {
    console: {
      type: "console",
      layout: useJsonLayout 
        ? { type: "json" }
        : { 
            type: "pattern", 
            pattern: "%[[%d] [%p] [%c]%] %m" 
          }
    }
  },
  categories: {
    default: { 
      appenders: ["console"], 
      level: logLevel 
    }
  }
})

// Export a configured logger for the application
export const logger = log4js.getLogger("mcp-server")