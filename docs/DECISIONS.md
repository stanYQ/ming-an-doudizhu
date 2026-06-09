# 技术决策记录

> 记录每一个重要的技术选型变更，防止重复争论。

---

## ADR-001：UI 框架从 FairyGUI 改为 Cocos Creator 原生 UI

**日期**: 2026-06  
**状态**: 已确认  
**影响范围**: client/

### 决策

放弃 FairyGUI，改用 Cocos Creator 3.8 原生 UI 系统（Label / Sprite / Layout / Widget / Canvas）。

### 原因

- Cocos Creator 原生 UI 与引擎深度集成，无需额外插件维护
- 减少第三方依赖，降低版本兼容风险
- 原生 UI 对微信小程序构建更友好，包体更小
- 团队不需要额外学习 FairyGUI 工作流

### 影响

- TDD v1.0 第一章中 FairyGUI 选型作废，以本文档为准
- client/CLAUDE.md 已更新：UI 框架改为「Cocos Creator 原生 UI」
- oops-framework 继续保留（资源/场景/音频管理，与 UI 框架无关）

### 不影响

- 服务端选型不变
- shared/ 选型不变
- Colyseus.js 客户端不变

---
