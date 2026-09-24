import type { Request, Response } from "express";

const normalizePath = (value: string) => {
  const path = value.trim();
  return `/${path.replace(/^\/+|\/+$/g, "")}`;
};

export function getClientInit(_req: Request, res: Response) {
  res.setHeader("Cache-Control", "no-store");
  return res.json({
    gatewayPath: normalizePath(process.env.API_GATEWAY_PATH || "/api/v1"),
    protocolVersion: 1,
  });
}