import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: { service: process.env.OCEANX_SERVICE ?? "web" },
  redact: {
    paths: ["password", "*.password", "token", "*.token", "headers.cookie", "*.passwordHash", "*.secret"],
    censor: "[redacted]",
  },
});
