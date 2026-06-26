/**
 * @file SettlementLogic.ts
 * @description 结算阶段业务逻辑：再来一局 / 离开房间，只调用 NetManager，无 CC / oops 依赖。
 * @module logic
 * @layer logic
 */

export interface NetLike {
    requestRematch(): void;
    leaveRoom(): Promise<void>;
}

export class SettlementLogic {
    /** 发送再来一局请求。 */
    requestRematch(net: NetLike): void {
        net.requestRematch();
    }

    /** 离开当前房间。 */
    leaveRoom(net: NetLike): Promise<void> {
        return net.leaveRoom();
    }
}
