# Spec: 启动页 + 登录

**任务 ID**: TASK-010b  
**目标模块**: client  
**优先级**: P2  
**状态**: ready  
**前置依赖**: TASK-017（AuthService Stub）done

---

## 背景

来源：GDD v1.0 第七章（7.1 界面清单 — 启动/登录）。App 冷启动后的第一个界面：加载资源、获取微信用户身份、换取 JWT token，成功后跳转大厅。P2 阶段对接 Stub AuthService（`AUTH_MODE=stub`），P4 替换为真实微信 OAuth，客户端代码不变。

## 验收标准

### 启动加载

- AC-1: App 启动后展示加载界面（Logo + 进度条），期间预加载 `common` 分包资源
- AC-2: 加载完成（资源就绪）后自动进入登录流程，无需用户操作
- AC-3: 加载超时（> 10s）→ 展示「网络异常，请重试」+ 重试按钮

### 登录流程

- AC-4: 调用 `POST /auth/login`，请求体 `{ code: "stub_login" }`（Stub 模式固定 code）
- AC-5: 登录成功 → 将 `token` 和 `UserProfile` 存入本地缓存，跳转 `HallView`
- AC-6: 登录失败（服务端返回非 200）→ 展示「登录失败，请重试」+ 重试按钮
- AC-7: 本地缓存中已有未过期 token → 跳过登录请求，直接进入大厅（免登录）
- AC-8: token 已过期（exp < 当前时间）→ 清除缓存，重新执行登录流程

### P4 微信接入预留

- AC-9: 登录函数接受 `code` 参数；Stub 阶段传固定值，P4 替换为 `wx.login()` 返回的真实 code，调用层代码不变

## 接口 / 数据结构

```typescript
// client/assets/scripts/ui/LaunchView.ts

export class LaunchView {
  onLoad(): void;      // 启动加载 + 自动登录流程
  private loadAssets(): Promise<void>;
  private doLogin(): Promise<void>;
  private onLoginSuccess(token: string, user: UserProfile): void;
  private onLoginFailed(): void;
}

// 本地缓存 key（统一管理，不散落各处）
const CACHE_KEY_TOKEN = "ddz_token";
const CACHE_KEY_USER  = "ddz_user";
```

### 主流程

```
App 启动
  → LaunchView.onLoad()
  → loadAssets()（预加载 common 分包）
  → 检查本地 token 是否有效
      有效 → 直接跳 HallView
      无效/不存在 → doLogin()
          → POST /auth/login
          成功 → 存缓存 → HallView
          失败 → 展示重试
```

## 约束

- 本地缓存使用 Cocos Creator 原生存储（`cc.sys.localStorage` 或平台对应方案），不引入第三方存储库；具体 API 由 dev 在 Cocos Creator 3.8 框架内决定
- `UserProfile` 数据结构与 TASK-017 `AuthService` 完全一致，不得自行扩展字段
- token 过期判断在客户端本地做（解析 JWT payload 的 `exp` 字段），不依赖服务端 401 响应

## 不在范围内

- 真实 `wx.login()` 调用 —— P4
- 微信授权弹窗（获取头像/昵称）—— P4
- 多端登录差异处理（H5 游客模式等）—— P4

## 测试要求

- 单元测试覆盖全部 9 条 AC
- 边界情况：token 恰好过期（exp = 当前时间，AC-8）、加载超时（AC-3）
- 错误路径：AC-6（服务端 500）、AC-3（网络超时）
