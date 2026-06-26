/**
 * @file HandCardView.ts
 * @description 手牌渲染与选牌交互组件：排序展示、对象池复用、牌型实时提示。
 * @module client/ui
 */

import { PatternType } from '../../shared/CardPattern';
import { compareValue } from '../../shared/CardEncoding';
import { parse } from '../../shared/PatternHelper';

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
  // 由 Cocos 场景绑定注入（测试中传入 stub 对象）
  _playButton:   { interactable: boolean } = { interactable: false };
  _patternLabel: { string: string }        = { string: '请选择合法牌型' };

  private _cards:    number[] = [];
  private _selected: Set<number> = new Set(); // sorted _cards 数组的下标集合
  private _interactable = true;

  /**
   * 接收服务端发来的手牌，按牌力升序排列后渲染。
   * @param cards 0-107 编码的手牌数组
   */
  render(cards: number[]): void {
    this._cards = [...cards].sort((a, b) => compareValue(a) - compareValue(b));
    this._selected.clear();
    this._updatePatternUI();
  }

  /** 返回当前持有的完整手牌（已排序）。 */
  getCards(): number[] {
    return this._cards;
  }

  /**
   * 切换指定位置的选中状态，并实时更新牌型提示。
   * @param index 排序后 _cards 数组的下标，非牌编码
   */
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

  /** 返回当前选中的牌（原始编码，按下标升序）。 */
  getSelectedCards(): number[] {
    return [...this._selected].sort((a, b) => a - b).map(i => this._cards[i]);
  }

  /** 清空所有选中状态并重置牌型提示。 */
  clearSelection(): void {
    this._selected.clear();
    this._updatePatternUI();
  }

  /**
   * 控制手牌区是否响应点击（非本人回合时禁用）。
   * @param enabled true = 可交互
   */
  setInteractable(enabled: boolean): void {
    this._interactable = enabled;
  }

  /**
   * 接收地主底牌并展示（仅地主调用）。空实现，UI 渲染由后续任务完成。
   * @param _cards 底牌编码数组，长度 3
   */
  showBottomCards(_cards: number[]): void {}

  // 根据当前选牌实时更新出牌按钮可用状态和牌型文字提示
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
