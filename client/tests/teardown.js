'use strict';
// Jest globalTeardown — 集成测试跑完后自动输出战报
const { execFileSync } = require('child_process');
const path = require('path');

module.exports = async function () {
  const script = path.resolve(__dirname, '../../server/tools/battle-report.js');
  try {
    execFileSync(process.execPath, [script], { stdio: 'inherit' });
  } catch {
    // 服务端未启动时静默跳过，不影响测试结果
  }
};
