import http from "http";
import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { CardRoom } from "./rooms/CardRoom";
import { handleLogin, handleMe } from "./routes/authRoutes";

const PORT = Number(process.env.PORT ?? 2567);

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const httpServer = http.createServer(async (req, res) => {
  const url    = req.url?.split("?")[0] ?? "";
  const method = req.method ?? "";

  // 处理 CORS 预检
  if (method === "OPTIONS") {
    res.writeHead(204, CORS_HEADERS).end();
    return;
  }

  // 所有响应带 CORS 头
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

  if (method === "POST" && url === "/auth/login") { await handleLogin(req, res); return; }
  if (method === "GET"  && url === "/auth/me")    { await handleMe(req, res);    return; }

  res.writeHead(404).end();
});

const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
});

gameServer.define("game", CardRoom);

gameServer.listen(PORT).then(() => {
  console.log(`[server] listening on ws://localhost:${PORT}`);
});
