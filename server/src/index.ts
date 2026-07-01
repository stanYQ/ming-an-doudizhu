/**
 * @file index.ts
 * @description Colyseus 服务端入口：HTTP 服务器 + WebSocket transport + 路由挂载
 * @module server
 */
import "dotenv/config";
import http from "http";
import { Server, matchMaker } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { CardRoom } from "./rooms/CardRoom";
import { handleLogin, handleMe } from "./routes/authRoutes";
import { handleLeaderboard, handleCheckin } from "./routes/gameRoutes";

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

  if (method === "POST" && url === "/auth/login")       { await handleLogin(req, res);      return; }
  if (method === "GET"  && url === "/auth/me")          { await handleMe(req, res);         return; }
  if (method === "GET"  && url === "/api/leaderboard")  { await handleLeaderboard(req, res); return; }
  if (method === "POST" && url === "/api/checkin")      { await handleCheckin(req, res);    return; }

  if (method === "GET" && url.startsWith("/rooms/code/")) {
    const code = url.slice("/rooms/code/".length).toUpperCase();
    const rooms = await matchMaker.query({ name: "game" });
    const found = rooms.find(r => r.metadata?.roomCode === code);
    res.setHeader("Content-Type", "application/json");
    if (found) {
      res.writeHead(200).end(JSON.stringify({ roomId: found.roomId }));
    } else {
      res.writeHead(404).end(JSON.stringify({ error: "room not found" }));
    }
    return;
  }

  res.writeHead(404).end();
});

const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
});

gameServer.define("game", CardRoom).filterBy(["isFriendRoom"]);

gameServer.listen(PORT).then(() => {
  console.log(`[server] listening on ws://localhost:${PORT}`);
});
