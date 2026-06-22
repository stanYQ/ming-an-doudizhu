/**
 * @file LaunchView.ts
 * @description 启动页：资源预加载 + JWT 缓存检查 + Stub 登录流程，成功后跳转大厅。
 * @module client/ui
 */

export interface UserProfile {
  userId:    number;
  openid:    string;
  nickname:  string;
  avatarUrl: string;
  score:     number;
  rankLevel: string;
}

const CACHE_KEY_TOKEN = 'ddz_token';
const CACHE_KEY_USER  = 'ddz_user';

export class LaunchView {
  // 由 Cocos 场景绑定注入（测试中传入 stub 对象）
  _errorLabel: { string: string; node: { active: boolean } } = { string: '', node: { active: false } };
  _retryBtn:   { node: { active: boolean } }                 = { node: { active: false } };

  /** 资源预加载函数，由场景装配脚本注入（CC 版加载分包；测试版 resolve immediately）。 */
  _loadAssets:      () => Promise<void>       = () => Promise.resolve();
  /** 登录 fetch，由场景装配脚本注入（CC 版调真实接口；测试版 mock）。 */
  _fetchLogin:      (code: string) => Promise<{ ok: boolean; status: number; json(): Promise<any> }>
                    = () => Promise.reject(new Error('not injected'));
  /** localStorage 封装，由场景装配脚本注入（CC 版用 sys.localStorage）。 */
  _storage:         { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void }
                    = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  /** 跳转大厅，由场景装配脚本注入（director.loadScene('HallScene')）。 */
  _navigateToHall:  () => void = () => {};
  /** 当前时间戳（毫秒），供测试注入 fake clock。 */
  _clock:           () => number = () => Date.now();
  /** 资源加载超时阈值（毫秒），默认 10s。 */
  _loadTimeout:     number = 10000;

  /**
   * 启动流程入口：加载资源 → 检查 JWT 缓存 → 登录 → 跳转大厅。
   * 超时或登录失败时显示错误提示和重试按钮。
   */
  async onLoad(): Promise<void> {
    const loaded = await this._withTimeout(this._loadAssets(), this._loadTimeout);
    if (!loaded) {
      this._showError('网络异常，请重试');
      return;
    }

    if (this._hasValidToken()) {
      this._navigateToHall();
      return;
    }

    await this._doLogin();
  }

  private async _doLogin(): Promise<void> {
    try {
      const res = await this._fetchLogin('stub_login');
      if (!res.ok) throw new Error('login failed');
      const body = await res.json() as { token: string; user: UserProfile };
      this._storage.setItem(CACHE_KEY_TOKEN, body.token);
      this._storage.setItem(CACHE_KEY_USER, JSON.stringify(body.user));
      this._navigateToHall();
    } catch {
      this._showError('登录失败，请重试');
    }
  }

  private _hasValidToken(): boolean {
    const token = this._storage.getItem(CACHE_KEY_TOKEN);
    if (!token) return false;
    const exp = this._parseExp(token);
    if (exp === null) return false;
    // exp 恰好等于当前秒也视为过期，避免边界值导致的极短有效窗口
    const nowSec = Math.floor(this._clock() / 1000);
    if (exp <= nowSec) {
      this._storage.removeItem(CACHE_KEY_TOKEN);
      this._storage.removeItem(CACHE_KEY_USER);
      return false;
    }
    return true;
  }

  private _parseExp(token: string): number | null {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return typeof payload.exp === 'number' ? payload.exp : null;
    } catch {
      return null;
    }
  }

  private _showError(msg: string): void {
    this._errorLabel.string      = msg;
    this._errorLabel.node.active = true;
    this._retryBtn.node.active   = true;
  }

  // Promise.race：加载成功时主动 clearTimeout 防止 open handle（Jest 测试泄漏）
  private async _withTimeout(p: Promise<void>, ms: number): Promise<boolean> {
    let timer: ReturnType<typeof setTimeout> | null = null;
    return Promise.race([
      p.then(() => { if (timer !== null) clearTimeout(timer); return true as const; }),
      new Promise<false>(res => { timer = setTimeout(() => res(false), ms); }),
    ]);
  }
}
