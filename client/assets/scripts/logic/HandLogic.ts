/**
 * @file HandLogic.ts
 * @description 手牌业务逻辑：出牌合法性校验（纯函数，无副作用）。
 * @module logic
 * @layer logic
 */

import { parse }       from '../shared/PatternHelper';
import { PatternType } from '../shared/CardPattern';

export class HandLogic {
    /**
     * 校验选中的牌是否构成合法牌型。
     * @param cards 选中的牌编码数组
     * @returns { valid, error? }
     */
    validate(cards: number[]): { valid: boolean; error?: string } {
        if (cards.length === 0) return { valid: false, error: '请选择要出的牌' };
        const pattern = parse(cards);
        if (pattern.type === PatternType.INVALID) return { valid: false, error: '牌型不合法' };
        return { valid: true };
    }
}
