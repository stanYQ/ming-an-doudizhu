jest.mock('cc', () => require('../__mocks__/cc'));
jest.mock('db://oops-framework/core/Oops', () => ({ oops: {} }));

import { LaunchLogic } from '../logic/LaunchLogic';
import type { UserProfile } from '../logic/LaunchLogic';

// JWT with exp in far future
const FUTURE_TOKEN  = makeJwt({ exp: Math.floor(Date.now() / 1000) + 3600 });
// JWT already expired
const EXPIRED_TOKEN = makeJwt({ exp: Math.floor(Date.now() / 1000) - 1 });

function makeJwt(payload: Record<string, unknown>): string {
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const body   = btoa(JSON.stringify(payload));
    return `${header}.${body}.sig`;
}

const stubUser: UserProfile = {
    userId: 1, openid: 'stub_user', nickname: '测试玩家',
    avatarUrl: '', score: 0, rankLevel: 'bronze',
};

function makeLogic() {
    const logic = new LaunchLogic();

    // 错误回调由 LaunchCtrl 注入；测试中直接观测 jest.fn()
    const onError = jest.fn();
    logic._onError = onError;

    // 资源预加载：立即完成
    logic._loadAssets = () => Promise.resolve();

    // 本地存储：内存 stub
    const store: Record<string, string> = {};
    logic._storage = {
        getItem:    (k) => store[k] ?? null,
        setItem:    (k, val) => { store[k] = val; },
        removeItem: (k) => { delete store[k]; },
        _store:     store,
    } as any;

    logic._navigateToHall = jest.fn();

    // 登录 fetch：默认成功
    logic._fetchLogin = jest.fn().mockResolvedValue({
        ok: true, status: 200,
        json: async () => ({ token: FUTURE_TOKEN, user: stubUser }),
    });

    logic._clock = () => Date.now();

    return { logic, onError };
}

describe('LaunchLogic — 登录流程', () => {
    test('AC-2: 加载完成后自动进入登录流程并跳转大厅', async () => {
        const { logic } = makeLogic();
        await logic.onLoad();
        expect(logic._navigateToHall).toHaveBeenCalledTimes(1);
    });

    test('AC-4: doLogin 发送 POST 请求，code = "stub_login"', async () => {
        const { logic } = makeLogic();
        await logic.onLoad();
        expect(logic._fetchLogin).toHaveBeenCalledWith('stub_login');
    });

    test('AC-5: 登录成功 → token 和 user 存入缓存', async () => {
        const { logic } = makeLogic();
        await logic.onLoad();
        const store = (logic._storage as any)._store;
        expect(store['ddz_token']).toBe(FUTURE_TOKEN);
        expect(JSON.parse(store['ddz_user']).nickname).toBe('测试玩家');
    });

    test('AC-6: 登录失败 → _onError("登录失败…")，不跳转', async () => {
        const { logic, onError } = makeLogic();
        logic._fetchLogin = jest.fn().mockResolvedValue({ ok: false, status: 500 });
        await logic.onLoad();
        expect(onError).toHaveBeenCalledWith(expect.stringContaining('登录失败'));
        expect(logic._navigateToHall).not.toHaveBeenCalled();
    });

    test('AC-7: 有效 token → 跳过登录，直接大厅', async () => {
        const { logic } = makeLogic();
        (logic._storage as any)._store['ddz_token'] = FUTURE_TOKEN;
        (logic._storage as any)._store['ddz_user']  = JSON.stringify(stubUser);
        await logic.onLoad();
        expect(logic._fetchLogin).not.toHaveBeenCalled();
        expect(logic._navigateToHall).toHaveBeenCalledTimes(1);
    });

    test('AC-8: 过期 token → 清除缓存，重新登录', async () => {
        const { logic } = makeLogic();
        (logic._storage as any)._store['ddz_token'] = EXPIRED_TOKEN;
        (logic._storage as any)._store['ddz_user']  = JSON.stringify(stubUser);
        await logic.onLoad();
        expect(logic._fetchLogin).toHaveBeenCalledTimes(1);
        expect(logic._navigateToHall).toHaveBeenCalledTimes(1);
    });

    test('AC-8: exp 恰好等于当前秒 → 视为过期', async () => {
        const now = Math.floor(Date.now() / 1000);
        const expiredNowToken = makeJwt({ exp: now });
        const { logic } = makeLogic();
        logic._clock = () => now * 1000;
        (logic._storage as any)._store['ddz_token'] = expiredNowToken;
        (logic._storage as any)._store['ddz_user']  = JSON.stringify(stubUser);
        await logic.onLoad();
        expect(logic._fetchLogin).toHaveBeenCalledTimes(1);
    });
});

describe('LaunchLogic — 加载超时', () => {
    test('AC-3: loadAssets 超时 → _onError("网络异常…")，不跳转', async () => {
        jest.useFakeTimers();
        const { logic, onError } = makeLogic();
        logic._loadTimeout = 5000;
        logic._loadAssets  = () => new Promise(() => {}); // 永不 resolve
        const p = logic.onLoad();
        jest.advanceTimersByTime(6000);
        await p;
        jest.useRealTimers();
        expect(onError).toHaveBeenCalledWith(expect.stringContaining('网络异常'));
        expect(logic._navigateToHall).not.toHaveBeenCalled();
    });
});
