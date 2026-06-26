/**
 * @file CodeCardSelector.ts
 * @description 地主专属暗号牌选择弹窗：4花色×8点数（3-10）共32格，确认后回调 GameController。
 * @module client/ui
 */

export interface CodeCardChoice {
  suit: number;  // 0=♠ 1=♥ 2=♦ 3=♣
  rank: number;  // 0=3 … 7=10
}

// 合法点数仅 3-10，对应 rank 0-7；J/Q/K/A/2 及王不可作暗号牌
const VALID_RANKS  = [0, 1, 2, 3, 4, 5, 6, 7];
const VALID_SUITS  = [0, 1, 2, 3];

export class CodeCardSelector {
  // 由 Cocos 场景绑定注入（测试中传入 stub 对象）
  _confirmBtn: { interactable: boolean } = { interactable: false };
  _rootNode:   { active: boolean }       = { active: false };

  /** 确认回调，由 GameController 注入。 */
  onConfirm: (choice: CodeCardChoice) => void = () => {};

  private _selected: CodeCardChoice | null = null;

  /** 返回合法 rank 列表（供 UI 渲染格子使用）。 */
  getValidRanks(): number[] { return [...VALID_RANKS]; }

  /** 返回合法花色列表（供 UI 渲染格子使用）。 */
  getValidSuits(): number[] { return [...VALID_SUITS]; }

  /** 显示弹窗并重置选中状态。 */
  show(): void {
    this._rootNode.active = true;
    this._selected        = null;
    this._confirmBtn.interactable = false;
  }

  /** 隐藏弹窗并清空选中。 */
  hide(): void {
    this._rootNode.active         = false;
    this._selected                = null;
    this._confirmBtn.interactable = false;
  }

  /**
   * 选中指定格子，非法 rank 静默丢弃。
   * @param suit 花色编码 0-3
   * @param rank 点数编码 0-7（对应 3-10）
   */
  selectCell(suit: number, rank: number): void {
    if (!VALID_RANKS.includes(rank)) return;
    this._selected                = { suit, rank };
    this._confirmBtn.interactable = true;
  }

  /**
   * 触发确认回调（无选中时静默忽略）。
   * 注意：由确认按钮的 ClickEvent 或测试直接调用。
   */
  confirmSelection(): void {
    if (!this._selected) return;
    this.onConfirm(this._selected);
  }

  /** 返回当前选中的暗号牌（未选中时为 null）。 */
  getSelectedChoice(): CodeCardChoice | null { return this._selected; }
}
