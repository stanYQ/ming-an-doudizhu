import { Schema, type } from "@colyseus/schema";

/** Per-player public state synchronized to all clients via Colyseus delta encoding. */
export class Player extends Schema {
  @type("string")  sessionId: string  = "";
  @type("number")  handCount: number  = 0;
  @type("string")  role: string       = ""; // "landlord" | "partner" | "civilian"
  @type("boolean") revealed: boolean  = false;
  @type("number")  seatIndex: number  = 0;
  @type("boolean") isAI: boolean      = false; // true = AI 补位玩家，clients 中为 fakeClient
}
