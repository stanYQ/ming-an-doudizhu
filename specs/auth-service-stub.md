# Spec: 鉴权占位服务 AuthService (Stub)

**任务 ID**: TASK-017  
**目标模块**: server  
**优先级**: P2  
**状态**: ready  
**前置依赖**: TASK-004（infra DDL done，users 表已存在）

---

## 背景

来源：TDD v1.0 第四章（AuthService）。P2 阶段 client-dev 需要用户信息（昵称、积分、段位）才能渲染大厅界面。真实微信 OAuth 接入（code → openid → session_key）属于平台对接工作，留 P4 上线前实现。

本任务实现**占位版 AuthService**：接口签名与生产版完全一致，返回固定测试数据，不接入任何第三方 SDK。client-dev 按此接口开发，P4 替换实现时客户端代码零改动。

## 验收标准

### 登录接口（HTTP POST /auth/login）

- AC-1: 请求体 `{ code: string }` → 响应 `{ token: string, user: UserProfile }`
- AC-2: Stub 模式下，任意 `code` 均返回成功（不验证真实性）
- AC-3: 返回的 `token` 为有效 JWT，payload 包含 `{ userId, openid, exp }`
- AC-4: `exp` 为当前时间 + 24 小时
- AC-5: 返回的 `UserProfile` 来自 `users` 表；若该 openid 首次登录则自动创建新用户（默认值：青铜段位、1000 积分）
- AC-6: Stub 模式下 openid 由服务端从 `code` 直接派生（如 `stub_${code}`），不调用微信接口

### Token 校验中间件

- AC-7: Colyseus Room `onAuth` 钩子验证 JWT；token 有效则允许加入，无效返回 `{ code: 3001 }`
- AC-8: HTTP 接口通过 Authorization Header（`Bearer <token>`）校验，无 token 返回 401

### 用户信息接口（HTTP GET /auth/me）

- AC-9: 携带有效 token → 返回当前用户的 `UserProfile`
- AC-10: token 无效或过期 → 返回 401

## 接口 / 数据结构

```typescript
// server/src/services/AuthService.ts

export interface UserProfile {
  userId: number;
  openid: string;
  nickname: string;
  avatarUrl: string;
  score: number;
  rankLevel: string;   // "bronze" | "silver" | "gold" | "platinum" | "diamond" | "master"
}

export interface LoginResponse {
  token: string;       // JWT
  user: UserProfile;
}

export class AuthService {
  /** 占位登录：code 直接派生 openid，不调用微信接口 */
  static async login(code: string): Promise<LoginResponse>;

  /** 验证 JWT，返回 payload 或 null */
  static verifyToken(token: string): { userId: number; openid: string } | null;

  /** 按 userId 查询用户信息 */
  static async getUser(userId: number): Promise<UserProfile | null>;
}
```

### 路由注册

```
POST /auth/login   → AuthService.login(code)
GET  /auth/me      → AuthService.getUser(tokenPayload.userId)
```

### 占位 → 生产替换说明

```
P4 接入微信 SDK 时，只需替换 AuthService.login() 内部实现：
  stub:       openid = `stub_${code}`
  production: openid = 调用 wx.code2Session(code).openid
接口签名、JWT 结构、路由不变，client 零改动。
```

## 约束

- JWT 密钥从环境变量 `JWT_SECRET` 读取，不 hardcode
- Stub 模式通过环境变量 `AUTH_MODE=stub` 启用（生产切换为 `AUTH_MODE=wechat`）
- 不引入微信 SDK（`weixin-node-sdk` 等），Stub 阶段无第三方依赖
- `users` 表自动建档（首次登录 INSERT，已存在则 SELECT）

## 不在范围内

- 真实微信 OAuth（code → openid）—— P4
- 刷新 token / token 续期 —— P4
- 多端登录（H5 / App 的不同登录方式）—— P4
- 封号、封禁逻辑 —— P4

## 测试要求

- 单元测试覆盖全部 10 条 AC
- 边界情况：首次登录自动建档（AC-5）、token 过期（AC-8/AC-10）
- 错误路径：无 token 的请求（AC-8）、Colyseus onAuth 收到无效 token（AC-7）
