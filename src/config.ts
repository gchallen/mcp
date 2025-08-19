import "dotenv/config"

export const PORT = Number(process.env.PORT) || 3232

export const BASE_URI = process.env.BASE_URI || "https://localhost:3232"

// Parse comma-separated list of approved user email addresses
export const APPROVED_USERS = process.env.APPROVED_USERS
  ? process.env.APPROVED_USERS.split(",").map((email) => email.trim().toLowerCase())
  : []
