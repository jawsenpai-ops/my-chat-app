import type { Request, Response, NextFunction } from "express";

export const errorHandler = (err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Request failed", { message: err.message });
  const statusCode = res.statusCode !== 200 ? res.statusCode : 500;
  res.status(statusCode).json({ message: statusCode >= 500 ? "Internal Server Error" : err.message || "Request failed" });
};