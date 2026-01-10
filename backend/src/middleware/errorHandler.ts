import type { Request, Response, NextFunction } from "express";

export interface ApiError extends Error {
  statusCode?: number;
  details?: unknown;
}

export function errorHandler(
  err: ApiError | Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  console.error("Error:", err);

  const statusCode = "statusCode" in err && err.statusCode ? err.statusCode : 500;
  const message = err.message || "Internal server error";
  const details = "details" in err ? err.details : undefined;

  const response: Record<string, unknown> = {
    error: message,
  };

  if (details !== undefined && details !== null) {
    response.details = details;
  }

  if (process.env.NODE_ENV === "development" && err.stack) {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
}

