import http from "http";
import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { CardRoom } from "./rooms/CardRoom";
import { handleLogin, handleMe } from "./routes/authRoutes";

const PORT = Number(process.env.PORT ?? 3000);

const httpServer = http.createServer(async (req, res) => {
  const url    = req.url?.split("?")[0] ?? "";
  const method = req.method ?? "";

  if (method === "POST" && url === "/auth/login") { await handleLogin(req, res); return; }
  if (method === "GET"  && url === "/auth/me")    { await handleMe(req, res);    return; }

  res.writeHead(404).end();
});

const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
});

gameServer.define("card_room", CardRoom);

gameServer.listen(PORT).then(() => {
  console.log(`[server] listening on ws://localhost:${PORT}`);
});
