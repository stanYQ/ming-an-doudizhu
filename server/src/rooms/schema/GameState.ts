import { Schema, type, MapSchema, ArraySchema } from "@colyseus/schema";
import { Player } from "./Player";

/**
 * Room-wide state synchronized to all clients.
 * Private data (hands, timeouts) NEVER appears here — kept in CardRoom memory only.
 */
export class GameState extends Schema {
  @type("string") phase: string = "waiting";
  // waiting | dealing | landlord_select | playing | settlement | disposed

  @type({ map: Player }) players = new MapSchema<Player>();

  @type("number")   currentTurnSeat: number = -1;
  @type("string")   lastPlayerId: string    = "";
  @type(["number"]) lastPlay = new ArraySchema<number>();

  @type("number")   landlordSeat: number = -1;
  @type("boolean")  isAlone: boolean     = false;

  // Doubling phase
  @type("boolean") doublingPhase:        boolean = false;
  @type("number")  landlordDoubleValue:  number  = 0; // 0=未选 1=不加倍 2=加倍

  // Friend room — 好友房房主（首位入房者），force_start 权限校验依据
  @type("string")  ownerSessionId: string = "";
}
