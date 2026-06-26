/**
 * @file LaunchLogic.ts
 * @description 启动页业务逻辑：资源预加载编排、JWT 校验、Stub 登录、页面跳转决策。
 *              纯 TS，无 CC import，无 oops.* 依赖（依赖通过注入传入）。
 * @module logic
 * @layer logic
 */

export interface UserProfile {
    userId:    number;
    openid:    string;
    nickname:  string;
    avatarUrl: string;
    score:     number;
    rankLevel: string;
}

type StorageAdapter = {
    getItem(k: string): string | null;
    setItem(k: string, v: string): void;
    removeItem(k: string): void;
};

const CACHE_KEY_TOKEN = 'ddz_token';
const CACHE_KEY_USER  = 'ddz_user';

export class LaunchLogic {
    /** 资源预加载，LaunchCtrl 注入（调 oops.res.loadBundle）。 */
    _loadAssets:     () => Promise<void>       = () => Promise.resolve();
    /** 登录 fetch，LaunchCtrl 注入（调真实 fetch）。 */
    _fetchLogin:     (code: string) => Promise<{ ok: boolean; status: number; json(): Promise<any> }>
                     = () => Promise.reject(new Error('not injected'));
    /** 本地存储适配器，LaunchCtrl 注入（调 oops.storage）。 */
    _storage:        StorageAdapter = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
    /** 跳转大厅，LaunchCtrl 注入（调 director.loadScene('HallScene')）。 */
    _navigateToHall: () => void = () => {};
    /** 错误回调，LaunchCtrl 注入（显示 errorLabel 节点）。 */
    _onError:        (msg: string) => void = () => {};
    /** 当前时间戳（毫秒），测试时注入 fake clock。 */
    _clock:          () => number = () => Date.now();
    /** 资源加载超时阈值（毫秒）。 */
    _loadTimeout:    number = 10000;

    /**
     * 启动流程入口：加载资源 → 检查 JWT 缓存 → 登录 → 跳转大厅。
     */
    async onLoad(): Promise<void> {
        const loaded = await this._withTimeout(this._loadAssets(), this._loadTimeout);
        if (!loaded) {
            this._onError('网络异常，请重试');
            return;
        }
        if (this.hasValidToken()) {
            this._navigateToHall();
            return;
        }
        await this._doLogin();
    }

    /**
     * 检查本地 token 是否存在且未过期（exp > 当前秒）。
     */
    hasValidToken(): boolean {
        const token = this._storage.getItem(CACHE_KEY_TOKEN);
        if (!token) return false;
        const exp = this.parseTokenExp(token);
        if (exp === null) return false;
        const nowSec = Math.floor(this._clock() / 1000);
        if (exp <= nowSec) {
            this._storage.removeItem(CACHE_KEY_TOKEN);
            this._storage.removeItem(CACHE_KEY_USER);
            return false;
        }
        return true;
    }

    /**
     * 解析 JWT payload 中的 exp 字段（秒）。
     */
    parseTokenExp(token: string): number | null {
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            return typeof payload.exp === 'number' ? payload.exp : null;
        } catch {
            return null;
        }
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
            this._onError('登录失败，请重试');
        }
    }

    private async _withTimeout(p: Promise<void>, ms: number): Promise<boolean> {
        let timer: ReturnType<typeof setTimeout> | null = null;
        return Promise.race([
            p.then(() => { if (timer !== null) clearTimeout(timer); return true as const; }),
            new Promise<false>(res => { timer = setTimeout(() => res(false), ms); }),
        ]);
    }
}
