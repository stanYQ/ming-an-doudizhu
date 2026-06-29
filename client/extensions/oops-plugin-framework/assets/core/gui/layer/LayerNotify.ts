/*
 * @Author: dgflash
 * @Date: 2022-08-15 10:06:47
 * @LastEditors: dgflash
 * @LastEditTime: 2022-09-02 13:44:12
 */
import { BlockInputEvents, Node, director, instantiate } from "cc";
import { ViewUtil } from "../../utils/ViewUtil";
import { PromptResType } from "../GuiEnum";
import { Notify } from "../prompt/Notify";
import { LayerHelper } from "./LayerHelper";

/* 滚动消息提示层 */
export class LayerNotify extends Node {
    private black!: BlockInputEvents;
    private wait: Node = null!;
    private notify: Node = null!;
    private notifyItem: Node = null!;
    private notifyPool: Node[] = [];

    constructor(name: string) {
        super(name);
        LayerHelper.setFullScreen(this);

        this.black = this.addComponent(BlockInputEvents);
        this.black.enabled = false;
    }

    /** 打开等待提示 */
    async waitOpen() {
        if (this.wait == null) {
            // 兼容编辑器预览模式
            if (EDITOR) {
                this.wait = await ViewUtil.createPrefabNodeAsync(PromptResType.Wait);
            }
            else {
                this.wait = ViewUtil.createPrefabNode(PromptResType.Wait);
            }
        }

        if (this.wait.parent == null) {
            this.wait.parent = this;
            this.black.enabled = true;
        }
    }

    /** 关闭等待提示 */
    waitClose() {
        if (this.wait && this.wait.parent) {
            this.wait.parent = null;
            this.black.enabled = false;
        }
    }

    /**
     * 渐隐飘过提示
     * @param content 文本表示
     * @param useI18n 是否使用多语言
     */
    async toast(content: string, useI18n: boolean) {
        if (!this.notify?.isValid) {
            this.notify = await ViewUtil.createPrefabNodeAsync(PromptResType.Toast);
            this.notifyItem = this.notify.children[0];
            this.notifyItem.parent = null;
        }

        // LayerNotify 是持久化节点，不在 Canvas 渲染树内；把容器直接挂到当前场景 Canvas
        const canvas = director.getScene()?.getChildByName('Canvas');
        const container = (canvas?.isValid ? canvas : this) as Node;
        if (this.notify.parent !== container) {
            this.notify.parent = container;
            this.notify.setPosition(0, 260, 0); // 屏幕上方，相对 Canvas 中心
        }
        const childNode = this._getItem();
        childNode.parent = this.notify;
        const prompt = childNode.getChildByName("prompt")!;
        const toastCom = prompt.getComponent(Notify)!;

        toastCom.onComplete = () => {
            this._recycleItem(childNode);
            if (this.notify.children.length == 0) {
                this.notify.parent = null;
            }
        };
        toastCom.toast(content, useI18n);

        if (this.notify.children.length > 3) {
            this.notify.children[0].destroy();
        }
    }

    private _getItem(): Node {
        let node = this.notifyPool.pop();
        if (node?.isValid) return node;
        return instantiate(this.notifyItem);
    }

    private _recycleItem(node: Node): void {
        if (!node?.isValid) return;
        node.parent = null;
        this.notifyPool.push(node);
    }
}