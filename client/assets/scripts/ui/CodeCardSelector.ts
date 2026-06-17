/**
 * @file CodeCardSelector.ts
 * @description 地主专属暗号牌选择弹窗：4花色×8点数（3-10）共32格，确认后回调 GameController。
 * @module client/ui
 */

export interface CodeCardChoice {
  suit: number;  // 0=♠ 1=♥ 2=♦ 3=♣
  rank: number;  // 0=3 … 7=10
}

// AC-9: 合法点数仅 3-10，对应 rank 0-7
const VALID_RANKS  = [0, 1, 2, 3, 4, 5, 6, 7];
const VALID_SUITS  = [0, 1, 2, 3];

export class CodeCardSelector {
  _confirmBtn: { interactable: boolean } = { interactable: false };
  _rootNode:   { active: boolean }       = { active: false };

  onConfirm: (choice: CodeCardChoice) => void = () => {};

  private _selected: CodeCardChoice | null = null;

  getValidRanks(): number[] { return [...VALID_RANKS]; }
  getValidSuits(): number[] { return [...VALID_SUITS]; }

  show(): void {
    this._rootNode.active = true;
    this._selected        = null;
    this._confirmBtn.interactable = false;
  }

  hide(): void {
    this._rootNode.active         = false;
    this._selected                = null;
    this._confirmBtn.interactable = false;
  }

  selectCell(suit: number, rank: number): void {
    // AC-9: 过滤非法点数（不在 0-7 范围内）
    if (!VALID_RANKS.includes(rank)) return;
    this._selected                = { suit, rank };
    this._confirmBtn.interactable = true;
  }

  confirmSelection(): void {
    if (!this._selected) return;
    this.onConfirm(this._selected);
  }

  getSelectedChoice(): CodeCardChoice | null { return this._selected; }
}
