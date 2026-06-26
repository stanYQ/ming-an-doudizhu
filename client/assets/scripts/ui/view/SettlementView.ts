/**
 * @file SettlementView.ts
 * @description 结算界面：胜负横幅、全员身份/积分展示、倍率明细、操作按钮。
 *              V2 扩展：支持 breakdown 字段（底分、加倍明细、流水公式），向下兼容 V1。
 * @module client/ui
 */

export interface PlayerResult {
  playerId:   string;
  nickname:   string;
  role:       'landlord' | 'partner' | 'civilian';
  scoreDelta: number;
  isMe:       boolean;
}

// V2 加倍/底分明细（来自服务端 game_over 消息）
export interface BreakdownV2 {
  baseScore:       number;
  landlordDouble:  1 | 2;
  playerDoubles:   Record<string, 1 | 2>;  // sessionId → di
  isLandlordAlone: boolean;
  isSpring:        boolean;
  isAntiSpring:    boolean;
}

export interface SettlementData {
  winnerCamp:       0 | 1;
  players:          PlayerResult[];
  multiplier:       number;
  multiplierDetail: { mode: number; bombCount: number; rocketCount: number };
  breakdown?:       BreakdownV2;  // V2 新增，缺失时降级为 V1 展示
}

// game_over 服务端消息格式（GameController 传入 showResult）
export interface GameOverMsg {
  winnerCamp:   0 | 1;
  scores?:      Array<{ sessionId: string; scoreDelta: number; newScore: number }>;
  breakdown?:   BreakdownV2;
  multiplier?:  number;
}

// 底分编码 → 场次名（与 scoring-v2.md AC-1 一致）
const BASE_SCORE_LABELS: Record<number, string> = { 1: '入门场', 2: '休闲场', 5: '精英场', 10: '巅峰场' };

// TASK-031c: 再来一局 rematch_update 消息格式
export interface RematchUpdateMsg {
    agreedCount: number;
    total:       number;
}

export class SettlementView {
  // 由 Cocos 场景绑定注入（测试中传入 stub 对象）
  _rootNode:           { active: boolean }                           = { active: false };
  _bannerLabel:        { string: string }                            = { string: '' };
  _playAgainBtn:       { interactable: boolean }                     = { interactable: false };
  _returnHallBtn:      { interactable: boolean }                     = { interactable: false };
  // TASK-031c: 再来一局状态区（AC-10/11/14）
  _rematchStatusLabel: { string: string; node: { active: boolean } } = { string: '', node: { active: false } };

  /** 再来一局回调（已废弃，仅保留向下兼容）。 */
  onPlayAgain:  () => void = () => {};
  /** 返回大厅回调，由场景装配脚本注入（跳 HallScene）。 */
  onReturnHall: () => void = () => {};

  /** 发送 request_rematch，由场景装配脚本注入（调用 NetManager.requestRematch）。 */
  _requestRematch:       () => void              = () => {};
  /** 离开当前房间，由场景装配脚本注入（调用 NetManager.leaveRoom）。 */
  _leaveRoom:            () => Promise<void>     = () => Promise.resolve();
  /** 跳转大厅，由场景装配脚本注入。 */
  _navigateToHall:       () => void              = () => {};
  /** 进入快速匹配等待界面（requeue 场景），由场景装配脚本注入。 */
  _navigateToQuickMatch: () => void              = () => {};
  // 注入定时器以支持 Jest 测试中的假定时器（与 DoublingView 模式相同）
  _setTimeout:   (fn: () => void, ms: number) => any = (fn, ms) => setTimeout(fn, ms);
  _clearTimeout: (id: any) => void                   = (id)     => clearTimeout(id);

  private _data:              SettlementData | null = null;
  private _animating          = false;
  private _rematchPending     = false;
  private _rematchTimerHandle: any = null;

  /**
   * 展示结算界面并启动动画序列。
   * 注意：按钮在动画期间禁用，必须等 finishAnimation() 调用后才可点击。
   * @param data 服务端下发的结算数据（含可选 V2 breakdown）
   */
  show(data: SettlementData): void {
    this._data               = data;
    this._rootNode.active    = true;
    this._animating          = true;
    this._playAgainBtn.interactable  = false;
    this._returnHallBtn.interactable = false;
    this._bannerLabel.string = data.winnerCamp === 1 ? '地主阵营获胜' : '平民阵营获胜';
    // 淡入 + 积分滚动动画由 Cocos tween 执行；动画结束后调用 finishAnimation() 启用按钮
  }

  /**
   * 接收服务端 game_over 消息并展示结算（GameController 调用）。
   * V2 消息含 breakdown 则显示明细；缺失则降级为 V1 格式，不报错。
   * @param msg 服务端 game_over 消息
   */
  showResult(msg: GameOverMsg): void {
    const players: PlayerResult[] = (msg.scores ?? []).map(s => ({
      playerId:   s.sessionId,
      nickname:   '',
      role:       'civilian' as const,
      scoreDelta: s.scoreDelta,
      isMe:       false,
    }));

    this.show({
      winnerCamp:       msg.winnerCamp,
      players,
      multiplier:       msg.multiplier ?? 0,
      multiplierDetail: { mode: 1, bombCount: 0, rocketCount: 0 },
      breakdown:        msg.breakdown,
    });
  }

  /** 隐藏结算界面。 */
  hide(): void {
    this._rootNode.active = false;
  }

  /**
   * Cocos tween 动画结束后调用，解锁操作按钮。
   * 测试中可直接调用以跳过动画等待。
   */
  finishAnimation(): void {
    this._animating                  = false;
    this._playAgainBtn.interactable  = true;
    this._returnHallBtn.interactable = true;
  }

  /**
   * 再来一局按钮回调（AC-10）。
   * 动画期间或已发送请求时静默忽略；否则发送 request_rematch 并等待服务端响应。
   */
  onPlayAgainClick(): void {
    if (this._animating) return;
    if (this._rematchPending) return;
    this._rematchPending            = true;
    this._playAgainBtn.interactable = false;
    this._rematchStatusLabel.string      = '等待中…';
    this._rematchStatusLabel.node.active = true;
    this._requestRematch();
    // 30 秒后未收到响应则恢复按钮并提示（AC-14）
    this._rematchTimerHandle = this._setTimeout(() => this._onRematchTimeout(), 30000);
  }

  /**
   * 返回大厅按钮回调（AC-15）。
   * 断开当前房间连接后跳转大厅；不发送 request_rematch。
   */
  onReturnHallClick(): void {
    if (this._animating) return;
    this._cancelRematchTimer();
    this._leaveRoom(); // fire-and-forget，不等待断连
    this.onReturnHall();
  }

  // ─── TASK-031c: 再来一局消息处理（AC-11~14）────────────────────────────────

  /**
   * 收到 rematch_update → 更新同意人数提示（AC-11）。
   * @param msg 服务端推送的同意进度
   */
  onRematchUpdate(msg: RematchUpdateMsg): void {
    this._rematchStatusLabel.string      = `${msg.agreedCount}/${msg.total} 人同意再来一局`;
    this._rematchStatusLabel.node.active = true;
  }

  /**
   * 收到 rematch_start → 隐藏结算界面，等待 DEALING 状态推送（AC-12）。
   */
  onRematchStart(): void {
    this._cancelRematchTimer();
    this.hide();
  }

  /**
   * 收到 rematch_redirect { action:"requeue" } → 离开当前房间并进入快速匹配（AC-13）。
   */
  onRematchRedirect(): void {
    this._cancelRematchTimer();
    this.hide();
    this._leaveRoom();           // fire-and-forget
    this._navigateToQuickMatch();
  }

  private _onRematchTimeout(): void {
    this._rematchPending                 = false;
    this._rematchTimerHandle             = null;
    this._playAgainBtn.interactable      = true;
    this._rematchStatusLabel.string      = '有玩家未同意';
    this._rematchStatusLabel.node.active = true;
  }

  private _cancelRematchTimer(): void {
    if (this._rematchTimerHandle !== null) {
      this._clearTimeout(this._rematchTimerHandle);
      this._rematchTimerHandle = null;
    }
  }

  /**
   * 将积分差值格式化为带符号字符串（含零值情况）。
   * @param delta 积分变化量，可为负
   * @returns 例如 '+10'、'-5'、'+0'
   */
  formatScore(delta: number): string {
    return delta >= 0 ? `+${delta}` : `${delta}`;
  }

  /** 返回所有玩家结算数据（顺序与服务端一致）。 */
  getPlayers(): PlayerResult[] {
    return this._data?.players ?? [];
  }

  /** 返回本人结算数据（找不到时返回 undefined）。 */
  getMe(): PlayerResult | undefined {
    return this._data?.players.find(p => p.isMe);
  }

  /** 返回本局最终倍率。 */
  getMultiplier(): number {
    return this._data?.multiplier ?? 0;
  }

  /** 返回倍率明细（叫地主模式、炸弹数、天炸数）。 */
  getMultiplierDetail(): SettlementData['multiplierDetail'] {
    return this._data?.multiplierDetail ?? { mode: 1, bombCount: 0, rocketCount: 0 };
  }

  // ── V2 新增方法（AC-1 ~ AC-13）────────────────────────────────────────────

  /** AC-2: 是否有 V2 breakdown 数据（缺失则降级为 V1）。 */
  hasBreakdown(): boolean {
    return this._data?.breakdown !== undefined;
  }

  /**
   * AC-3: 底分标签，如「底分 ×2（休闲场）」。
   * 无 breakdown 时返回 ''（V1 降级）。
   */
  getBaseScoreLabel(): string {
    const bd = this._data?.breakdown;
    if (!bd) return '';
    const name = BASE_SCORE_LABELS[bd.baseScore] ?? `底分${bd.baseScore}`;
    return `底分 ×${bd.baseScore}（${name}）`;
  }

  /**
   * AC-4/5: 返回触发的倍数明细行（未触发项不包含）。
   * 顺序：炸弹 → 王炸 → 春天/反春天 → 一挑四。
   */
  getMultiplierLines(): string[] {
    if (!this._data?.breakdown) return [];
    const { isSpring, isAntiSpring, isLandlordAlone } = this._data.breakdown;
    const { bombCount, rocketCount } = this._data.multiplierDetail;
    const lines: string[] = [];

    for (let i = 0; i < bombCount; i++) lines.push('炸弹 ×2');
    for (let i = 0; i < rocketCount; i++) lines.push('王炸 ×3');
    if (isSpring)        lines.push('春天 ×2');
    if (isAntiSpring)    lines.push('反春天 ×2');
    if (isLandlordAlone) lines.push('一挑四 ×3');

    return lines;
  }

  /**
   * AC-6: 全局倍数合计行，如「全局倍数 M = ×4」。
   * 无 breakdown 时返回 ''。
   */
  getGlobalMultiplierLine(): string {
    if (!this._data?.breakdown) return '';
    return `全局倍数 M = ×${this._data.multiplier}`;
  }

  /**
   * AC-7: 地主加倍标签。
   * 「地主加倍 ×2」或「地主未加倍」。
   */
  getLandlordDoubleLabel(): string {
    const bd = this._data?.breakdown;
    if (!bd) return '';
    return bd.landlordDouble === 2 ? '地主加倍 ×2' : '地主未加倍';
  }

  /**
   * AC-8: 指定座位的个人加倍标签。
   * @param sessionId 玩家 sessionId
   * @returns 「加倍 ×2」或「未加倍」
   */
  getPlayerDoubleLabel(sessionId: string): string {
    const bd = this._data?.breakdown;
    if (!bd) return '';
    return (bd.playerDoubles[sessionId] ?? 1) === 2 ? '加倍 ×2' : '未加倍';
  }

  /**
   * AC-9: 平民流水计算式（B × M × dL × di = 流水）。
   * 非平民或无 breakdown 时返回 ''。
   * 注意：流水为展示用，积分权威值以服务端 scoreDelta 为准。
   * @param sessionId 玩家 sessionId
   */
  getFlowText(sessionId: string): string {
    const bd = this._data?.breakdown;
    if (!bd) return '';
    const B  = bd.baseScore;
    const M  = this._data!.multiplier;
    const dL = bd.landlordDouble;
    const di = bd.playerDoubles[sessionId] ?? 1;
    const flow = B * M * dL * di;
    return `${B} × ${M} × ${dL} × ${di} = ${flow}`;
  }

  /** AC-11: 是否一挑四模式。 */
  isLandlordAloneMode(): boolean {
    return this._data?.breakdown?.isLandlordAlone ?? false;
  }

  /**
   * AC-13: 暗队友内部分配比例标签。
   * 未加倍 → 「内部分配：2:1」；加倍 → 「内部分配：1:1」。
   * @param partnerSessionId 暗队友 sessionId
   */
  getPartnerSplitLabel(partnerSessionId: string): string {
    const bd = this._data?.breakdown;
    if (!bd) return '';
    return (bd.playerDoubles[partnerSessionId] ?? 1) === 2
      ? '内部分配：1:1'
      : '内部分配：2:1';
  }
}
