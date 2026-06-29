/*
 * @Author: dgflash
 * @Date: 2022-04-14 17:08:01
 * @LastEditors: bansomin
 * @LastEditTime: 2025-01-02 10:47:47
 */
import { Component, Label, UIOpacity, Vec3, tween, _decorator } from "cc";
import { LanguageLabel } from "../../../libs/gui/language/LanguageLabel";

const { ccclass, property } = _decorator;

/** 滚动消息提示组件（Tween 版，无需 Animation Clip） */
@ccclass('Notify')
export class Notify extends Component {
    @property(Label)
    private lab_content: Label = null!;

    /** 提示动画完成 */
    onComplete: Function = null!;

    /**
     * 显示提示：上滑淡入(0.25s) → 停留(1.5s) → 淡出(0.35s) → 销毁
     * @param msg       文本
     * @param useI18n   true 时 msg 为多语言 key
     */
    toast(msg: string, useI18n: boolean) {
        const i18n = this.lab_content.getComponent(LanguageLabel);
        if (useI18n && i18n) {
            i18n.enabled = true;
            i18n.dataID = msg;
        } else {
            if (i18n) i18n.enabled = false;
            this.lab_content.string = msg;
        }

        let uiOpacity = this.node.getComponent(UIOpacity);
        if (!uiOpacity) uiOpacity = this.node.addComponent(UIOpacity);

        // 初始状态：从上方 30px、缩小 0.8、透明
        const endPos = this.node.position.clone();
        this.node.setPosition(endPos.x, endPos.y + 30, endPos.z);
        this.node.setScale(0.8, 0.8, 1);
        uiOpacity.opacity = 0;

        // 淡入 tween（与位移/缩放并行）
        const state = { opacity: 0 };
        tween(state)
            .to(0.22, { opacity: 255 }, {
                onUpdate: () => { if (uiOpacity!.isValid) uiOpacity!.opacity = state.opacity; },
                easing: 'sineOut',
            })
            .delay(0.8)
            .to(0.15, { opacity: 0 }, {
                // sineIn：开始慢、结尾快，感觉干净利落
                onUpdate: () => { if (uiOpacity!.isValid) uiOpacity!.opacity = state.opacity; },
                easing: 'sineIn',
            })
            .call(() => {
                this.onComplete?.();
                this.onComplete = null!;
            })
            .start();

        // 位移 + 缩放：backOut 产生轻微过冲回弹，有游戏感
        tween(this.node)
            .to(0.25, { position: endPos, scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
            .start();
    }
}
