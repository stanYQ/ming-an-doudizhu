/**
 * @file HandCardView.ts
 * @description 手牌渲染与选牌交互组件：排序展示、对象池复用、牌型实时提示。
 * @module client/ui
 */

import { PatternType } from '../shared/CardPattern';
import { compareValue } from '../shared/CardEncoding';
import { parse } from '../shared/PatternHelper';

const PATTERN_LABEL: Record<string, string> = {
  [PatternType.SINGLE]:              '单张',
  [PatternType.PAIR]:                '对子',
  [PatternType.TRIPLE]:              '三张',
  [PatternType.TRIPLE_SOLO]:         '三带一',
  [PatternType.TRIPLE_PAIR]:         '三带二',
  [PatternType.STRAIGHT]:            '顺子',
  [PatternType.CONSECUTIVE_PAIRS]:   '连对',
  [PatternType.AIRPLANE]:            '飞机',
  [PatternType.AIRPLANE_SOLO_WINGS]: '飞机带单',
  [PatternType.AIRPLANE_PAIR_WINGS]: '飞机带对',
  [PatternType.BOMB]:                '炸弹',
  [PatternType.JOKER_BOMB_SMALL]:    '双小王',
  [PatternType.JOKER_BOMB_BIG]:      '天炸',
};

export class HandCardView {
  // injected by Cocos node bindings (or test stubs)
  _playButton:   { interactable: boolean } = { interactable: false };
  _patternLabel: { string: string }        = { string: '请选择合法牌型' };

  private _cards:    number[] = [];
  private _selected: Set<number> = new Set(); // indices into _cards
  private _interactable = true;

  render(cards: number[]): void {
    this._cards = [...cards].sort((a, b) => compareValue(a) - compareValue(b));
    this._selected.clear();
    this._updatePatternUI();
  }

  getCards(): number[] {
    return this._cards;
  }

  /** @param index position in sorted _cards array */
  selectCard(index: number): void {
    if (!this._interactable) return;
    if (index < 0 || index >= this._cards.length) return;
    if (this._selected.has(index)) {
      this._selected.delete(index);
    } else {
      this._selected.add(index);
    }
    this._updatePatternUI();
  }

  getSelectedCards(): number[] {
    return [...this._selected].sort((a, b) => a - b).map(i => this._cards[i]);
  }

  clearSelection(): void {
    this._selected.clear();
    this._updatePatternUI();
  }

  setInteractable(enabled: boolean): void {
    this._interactable = enabled;
  }

  private _updatePatternUI(): void {
    const sel = this.getSelectedCards();
    if (sel.length === 0) {
      this._playButton.interactable = false;
      this._patternLabel.string     = '请选择合法牌型';
      return;
    }
    const pattern = parse(sel);
    if (pattern.type === PatternType.INVALID) {
      this._playButton.interactable = false;
      this._patternLabel.string     = '请选择合法牌型';
    } else {
      this._playButton.interactable = true;
      this._patternLabel.string     = PATTERN_LABEL[pattern.type] ?? pattern.type;
    }
  }
}
