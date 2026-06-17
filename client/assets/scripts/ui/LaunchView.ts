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
  _errorLabel: { string: string; node: { active: boolean } } = { string: '', node: { active: false } };
  _retryBtn:   { node: { active: boolean } }                 = { node: { active: false } };

  // Injectable dependencies (Cocos impls injected at runtime, mocks in tests)
  _loadAssets:      () => Promise<void>       = () => Promise.resolve();
  _fetchLogin:      (code: string) => Promise<{ ok: boolean; status: number; json(): Promise<any> }>
                    = () => Promise.reject(new Error('not injected'));
  _storage:         { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void }
                    = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  _navigateToHall:  () => void = () => {};
  _clock:           () => number = () => Date.now();
  _loadTimeout:     number = 10000;

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
    // AC-8: exp 恰好等于当前秒也视为过期
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

  // Resolves true on success, false on timeout; cancels the timer on success
  private async _withTimeout(p: Promise<void>, ms: number): Promise<boolean> {
    let timer: ReturnType<typeof setTimeout> | null = null;
    return Promise.race([
      p.then(() => { if (timer !== null) clearTimeout(timer); return true as const; }),
      new Promise<false>(res => { timer = setTimeout(() => res(false), ms); }),
    ]);
  }
}
