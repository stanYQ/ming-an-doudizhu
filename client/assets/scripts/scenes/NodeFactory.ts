/**
 * @file NodeFactory.ts
 * @description 运行时节点创建工具，供场景装配脚本使用。
 * @module client/scenes
 */

import {
    Node, Label, Button, Sprite, UITransform, Widget,
    Size, Vec3, Color, EventHandler,
} from 'cc';

export interface LabelCfg {
    name:     string;
    text?:    string;
    width?:   number;
    height?:  number;
    color?:   Color;
    fontSize?: number;
}

export interface BtnCfg {
    name:    string;
    label?:  string;
    width?:  number;
    height?: number;
}

/** 创建带 UITransform 的普通容器节点 */
export function makeNode(name: string, w = 0, h = 0): Node {
    const n = new Node(name);
    const t = n.addComponent(UITransform);
    t.contentSize = new Size(w, h);
    return n;
}

/** 创建 Label 节点，返回 [node, label] */
export function makeLabel(cfg: LabelCfg): [Node, Label] {
    const n = makeNode(cfg.name, cfg.width ?? 300, cfg.height ?? 40);
    const l = n.addComponent(Label);
    l.string   = cfg.text ?? '';
    l.fontSize = cfg.fontSize ?? 28;
    if (cfg.color) l.color = cfg.color;
    return [n, l];
}

/** 创建 Button 节点（含背景 + 文字），返回 [node, button, label] */
export function makeButton(cfg: BtnCfg): [Node, Button, Label] {
    const n   = makeNode(cfg.name, cfg.width ?? 240, cfg.height ?? 80);
    const btn = n.addComponent(Button);
    btn.transition = Button.Transition.SCALE;

    // 背景 sprite（纯色占位）
    const bg  = new Node('Background');
    bg.addComponent(Sprite);
    const bt = bg.addComponent(UITransform);
    bt.contentSize = new Size(cfg.width ?? 240, cfg.height ?? 80);
    bg.parent = n;

    // 文字
    const [lNode, lComp] = makeLabel({
        name: 'Label', text: cfg.label ?? cfg.name,
        width: cfg.width ?? 240, height: cfg.height ?? 80,
    });
    lNode.parent = n;

    return [n, btn, lComp];
}

/** 全屏覆盖 Widget（stretch 到 Canvas） */
export function makeFullscreenWidget(node: Node) {
    const w = node.addComponent(Widget);
    w.isAlignLeft = w.isAlignRight = w.isAlignTop = w.isAlignBottom = true;
    w.left = w.right = w.top = w.bottom = 0;
}

/** 工厂函数：绑定 Button.ClickEvents → 目标节点上的方法名 */
export function bindClick(btn: Button, targetNode: Node, component: string, method: string) {
    const eh    = new EventHandler();
    eh.target   = targetNode;
    eh.component = component;
    eh.handler  = method;
    btn.clickEvents.push(eh);
}
