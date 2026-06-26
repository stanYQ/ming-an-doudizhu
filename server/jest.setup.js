/**
 * Jest 全局 setup（CommonJS，不经 ts-jest 编译）
 *
 * patch setInterval / setTimeout 自动 .unref()，防止 Colyseus WebSocketTransport 的
 * pingInterval 在测试结束后阻止 worker 进程退出（BUG-003）。
 * unref 后 timer 仍正常触发，只是不再阻止 Node.js 事件循环空转退出。
 */
const _origSetInterval = global.setInterval;
global.setInterval = function (fn, delay, ...args) {
  const ref = _origSetInterval(fn, delay, ...args);
  if (ref && typeof ref.unref === "function") ref.unref();
  return ref;
};

const _origSetTimeout = global.setTimeout;
global.setTimeout = function (fn, delay, ...args) {
  const ref = _origSetTimeout(fn, delay, ...args);
  if (ref && typeof ref.unref === "function") ref.unref();
  return ref;
};
