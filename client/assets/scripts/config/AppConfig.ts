/**
 * @file AppConfig.ts
 * @description 全局运行时配置。上线前将 SERVER_URL 替换为生产地址。
 * @module client/config
 */

/** 服务端 WebSocket + HTTP 根地址。P0 Stub，上线前改为生产 URL。 */
export const SERVER_URL  = 'http://localhost:2567';

/** 加载/登录失败最大自动重试次数。 */
export const MAX_RETRIES = 3;
