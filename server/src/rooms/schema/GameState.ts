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
}
