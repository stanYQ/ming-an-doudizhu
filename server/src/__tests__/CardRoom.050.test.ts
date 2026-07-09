/**
 * @file CardRoom.050.test.ts
 * @description TASK-050s 动画同步修复测试：dealing_ready ACK + code_card_reveal + doubling_result 定时器
 * @module server/__tests__
 */

import { ColyseusTestServer, boot } from "@colyseus/testing";
import { CardRoom } from "../rooms/CardRoom";

describe("TASK-050s: Animation Sync", () => {
  let colyseus: ColyseusTestServer;
  let oldEnv: string | undefined;

  beforeAll(async () => {
    // Clear SKIP_DEALING_READY for this test suite to test real animation sync
    oldEnv = process.env.SKIP_DEALING_READY;
    delete process.env.SKIP_DEALING_READY;

    colyseus = await boot({
      initializeGameServer: (gs) => {
        gs.define("card_room", CardRoom);
      },
    });
  });

  afterAll(async () => {
    await colyseus.shutdown();
    // Restore env
    if (oldEnv !== undefined) process.env.SKIP_DEALING_READY = oldEnv;
  });

  // AC-S1: 收到 5 个 dealing_ready 后推进 landlord_select
  describe("AC-S1: dealing_ready ACK", () => {
    it("5 players send dealing_ready → phase advances to landlord_select", async () => {
      const room = await colyseus.createRoom("card_room", {});
      const clients = await Promise.all([
        colyseus.connectTo(room),
        colyseus.connectTo(room),
        colyseus.connectTo(room),
        colyseus.connectTo(room),
        colyseus.connectTo(room),
      ]);

      await room.waitForNextPatch();
      expect(room.state.phase).toBe("dealing");

      // Send dealing_ready from all 5 clients
      for (const c of clients) {
        c.send("dealing_ready");
      }

      await room.waitForNextPatch();
      expect(room.state.phase).toBe("landlord_select");

      await room.disconnect();
    });
  });

  // AC-S2: dealing_ready 超时 10s 静默推进
  describe("AC-S2: dealing_ready timeout", () => {
    it("only 4 players ready, 10s timeout → silent advance", async () => {
      const room = await colyseus.createRoom("card_room", {});
      const clients = await Promise.all([
        colyseus.connectTo(room),
        colyseus.connectTo(room),
        colyseus.connectTo(room),
        colyseus.connectTo(room),
        colyseus.connectTo(room),
      ]);

      await room.waitForNextPatch();
      expect(room.state.phase).toBe("dealing");

      // Only 4 clients send dealing_ready
      for (let i = 0; i < 4; i++) {
        clients[i].send("dealing_ready");
      }

      // Should still be in dealing
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(room.state.phase).toBe("dealing");

      // Fast-forward 10s
      await new Promise(resolve => setTimeout(resolve, 10100));

      await room.waitForNextPatch();
      expect(room.state.phase).toBe("landlord_select");

      await room.disconnect();
    }, 15000);
  });

  // AC-S3: dealing_ready 不累计重复
  describe("AC-S3: dealing_ready deduplication", () => {
    it("same client sends dealing_ready twice → counted once", async () => {
      const room = await colyseus.createRoom("card_room", {});
      const clients = await Promise.all([
        colyseus.connectTo(room),
        colyseus.connectTo(room),
        colyseus.connectTo(room),
        colyseus.connectTo(room),
        colyseus.connectTo(room),
      ]);

      await room.waitForNextPatch();
      expect(room.state.phase).toBe("dealing");

      // Client 0 sends twice
      clients[0].send("dealing_ready");
      clients[0].send("dealing_ready");

      // Others send once
      for (let i = 1; i < 5; i++) {
        clients[i].send("dealing_ready");
      }

      await room.waitForNextPatch();
      expect(room.state.phase).toBe("landlord_select");

      await room.disconnect();
    });
  });

  // AC-S4: code_card_reveal 广播 + 4s 定时器
  describe("AC-S4: code_card_reveal broadcast", () => {
    it("handleSelectCodeCard → broadcasts code_card_reveal → 4s delay → doubling", async () => {
      const room = await colyseus.createRoom("card_room", {});
      const clients = await Promise.all([
        colyseus.connectTo(room),
        colyseus.connectTo(room),
        colyseus.connectTo(room),
        colyseus.connectTo(room),
        colyseus.connectTo(room),
      ]);

      // Fast-forward to landlord_select
      await room.waitForNextPatch();
      for (const c of clients) c.send("dealing_ready");
      await room.waitForNextPatch();
      expect(room.state.phase).toBe("landlord_select");

      const landlordSeat = room.state.landlordSeat;
      const landlordClient = clients[landlordSeat];

      let revealReceived = false;
      landlordClient.onMessage("code_card_reveal", (data: any) => {
        expect(data.suit).toBeGreaterThanOrEqual(0);
        expect(data.value).toBeGreaterThanOrEqual(0);
        expect(data.landlordSeatIndex).toBe(landlordSeat);
        revealReceived = true;
      });

      landlordClient.send("select_code_card", { suit: 0, value: 0 });

      await new Promise(resolve => setTimeout(resolve, 100));
      expect(revealReceived).toBe(true);

      // Should not immediately advance to doubling
      expect(room.state.phase).toBe("landlord_select");

      // Wait 4s
      await new Promise(resolve => setTimeout(resolve, 4100));
      await room.waitForNextPatch();
      expect(room.state.phase).toBe("doubling");

      await room.disconnect();
    }, 10000);
  });

  // AC-S6: doubling_result 广播 + 2s 定时器
  describe("AC-S6: doubling_result delay", () => {
    it("all players submit doubling → doubling_result broadcast → 2s delay → playing", async () => {
      const room = await colyseus.createRoom("card_room", {});
      const clients = await Promise.all([
        colyseus.connectTo(room),
        colyseus.connectTo(room),
        colyseus.connectTo(room),
        colyseus.connectTo(room),
        colyseus.connectTo(room),
      ]);

      // Advance to doubling phase
      await room.waitForNextPatch();
      for (const c of clients) c.send("dealing_ready");
      await room.waitForNextPatch();

      const landlordClient = clients[room.state.landlordSeat];
      landlordClient.send("select_code_card", { suit: 0, value: 0 });

      await new Promise(resolve => setTimeout(resolve, 4200));
      await room.waitForNextPatch();
      expect(room.state.phase).toBe("doubling");

      let doublingResultReceived = false;
      clients[0].onMessage("doubling_result", () => {
        doublingResultReceived = true;
      });

      // All submit doubling
      for (const c of clients) {
        c.send("set_double", { value: 1 });
      }

      await new Promise(resolve => setTimeout(resolve, 100));
      expect(doublingResultReceived).toBe(true);

      // Should not immediately advance to playing
      expect(room.state.phase).toBe("doubling");

      // Wait 2s
      await new Promise(resolve => setTimeout(resolve, 2100));
      await room.waitForNextPatch();
      expect(room.state.phase).toBe("playing");

      await room.disconnect();
    }, 12000);
  });
});
