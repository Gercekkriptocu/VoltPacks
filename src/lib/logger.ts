import { createLogger, format, transports } from "winston";

const logger = createLogger({
  level: "info",
  format: format.combine(
    format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    format.json(),
    format.errors({ stack: true })
  ),
  transports: [
    new transports.Console(),
    new transports.File({ filename: "../output.log" }),
  ],
  exceptionHandlers: [
    new transports.Console(),
    new transports.File({ filename: "../error.log" }),
  ],
});

export default logger;
