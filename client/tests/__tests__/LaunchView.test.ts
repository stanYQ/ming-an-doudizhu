jest.mock('cc', () => require('../__mocks__/cc'));
jest.mock('db://oops-framework/core/Oops', () => ({ oops: {} }));

import { LaunchView } from '../ui/LaunchView';
import type { UserProfile } from '../ui/LaunchView';

// JWT with exp in far future
const FUTURE_TOKEN = makeJwt({ exp: Math.floor(Date.now() / 1000) + 3600 });
// JWT already expired
const EXPIRED_TOKEN = makeJwt({ exp: Math.floor(Date.now() / 1000) - 1 });

function makeJwt(payload: Record<string, unknown>): string {
    const header  = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const body    = btoa(JSON.stringify(payload));
    return `${header}.${body}.sig`;
}

const stubUser: UserProfile = {
    userId: 1, openid: 'stub_user', nickname: '测试玩家',
    avatarUrl: '', score: 0, rankLevel: 'bronze',
};

function makeView() {
    const v = new LaunchView();
    v._errorLabel  = { string: '', node: { active: false } };
    v._retryBtn    = { node: { active: false } };

    // Inject fast-completing loadAssets by default
    v._loadAssets  = () => Promise.resolve();

    // Default storage: empty
    const store: Record<string, string> = {};
    v._storage = {
        getItem:    (k) => store[k] ?? null,
        setItem:    (k, val) => { store[k] = val; },
        removeItem: (k) => { delete store[k]; },
        _store:     store,
    } as any;

    v._navigateToHall = jest.fn();

    // Default fetch: success
    v._fetchLogin = jest.fn().mockResolvedValue({
        ok: true, status: 200,
        json: async () => ({ token: FUTURE_TOKEN, user: stubUser }),
    });

    v._clock = () => Date.now();

    return v;
}

describe('LaunchView — 登录流程', () => {
    test('AC-2: 加载完成后自动进入登录流程并跳转大厅', async () => {
        const v = makeView();
        await v.onLoad();
        expect(v._navigateToHall).toHaveBeenCalledTimes(1);
    });

    test('AC-4: doLogin 发送 POST 请求，code = "stub_login"', async () => {
        const v = makeView();
        await v.onLoad();
        expect(v._fetchLogin).toHaveBeenCalledWith('stub_login');
    });

    test('AC-5: 登录成功 → token 和 user 存入缓存', async () => {
        const v = makeView();
        await v.onLoad();
        const store = (v._storage as any)._store;
        expect(store['ddz_token']).toBe(FUTURE_TOKEN);
        expect(JSON.parse(store['ddz_user']).nickname).toBe('测试玩家');
    });

    test('AC-6: 登录失败 → 显示错误，不跳转', async () => {
        const v = makeView();
        v._fetchLogin = jest.fn().mockResolvedValue({ ok: false, status: 500 });
        await v.onLoad();
        expect(v._errorLabel.node.active).toBe(true);
        expect(v._errorLabel.string).toContain('登录失败');
        expect(v._navigateToHall).not.toHaveBeenCalled();
    });

    test('AC-7: 有效 token → 跳过登录，直接大厅', async () => {
        const v = makeView();
        (v._storage as any)._store['ddz_token'] = FUTURE_TOKEN;
        (v._storage as any)._store['ddz_user']  = JSON.stringify(stubUser);
        await v.onLoad();
        expect(v._fetchLogin).not.toHaveBeenCalled();
        expect(v._navigateToHall).toHaveBeenCalledTimes(1);
    });

    test('AC-8: 过期 token → 清除缓存，重新登录', async () => {
        const v = makeView();
        (v._storage as any)._store['ddz_token'] = EXPIRED_TOKEN;
        (v._storage as any)._store['ddz_user']  = JSON.stringify(stubUser);
        await v.onLoad();
        expect(v._fetchLogin).toHaveBeenCalledTimes(1);
        expect(v._navigateToHall).toHaveBeenCalledTimes(1);
    });

    test('AC-8: exp 恰好等于当前秒 → 视为过期', async () => {
        const now = Math.floor(Date.now() / 1000);
        const expiredNowToken = makeJwt({ exp: now });
        const v = makeView();
        v._clock = () => now * 1000; // mock clock to same second
        (v._storage as any)._store['ddz_token'] = expiredNowToken;
        (v._storage as any)._store['ddz_user']  = JSON.stringify(stubUser);
        await v.onLoad();
        expect(v._fetchLogin).toHaveBeenCalledTimes(1);
    });
});

describe('LaunchView — 加载超时', () => {
    test('AC-3: loadAssets 超时 → 显示网络异常', async () => {
        jest.useFakeTimers();
        const v = makeView();
        v._loadTimeout = 5000;
        v._loadAssets  = () => new Promise(() => {}); // 永不 resolve
        const p = v.onLoad();
        jest.advanceTimersByTime(6000);
        await p;
        jest.useRealTimers();
        expect(v._errorLabel.node.active).toBe(true);
        expect(v._errorLabel.string).toContain('网络异常');
        expect(v._navigateToHall).not.toHaveBeenCalled();
    });
});
