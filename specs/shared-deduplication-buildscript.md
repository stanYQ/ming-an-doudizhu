# TASK-051B: shared 层自动同步（预构建脚本方案）

## 📋 元数据

- **任务 ID**: TASK-051B
- **优先级**: P1（技术债）
- **模块**: client + 构建工具
- **预估工时**: 2.5 小时
- **前置**: TASK-051 技术阻塞决策
- **关联**: specs/shared-deduplication.md（原始需求）

---

## 🎯 目标

通过 **npm script 预构建脚本**自动同步 `/shared/` → `client/assets/scripts/shared/`，消除手动同步开销，同时兼容 Cocos Creator 构建限制。

---

## 📐 验收标准

### AC-1: 同步脚本实现
- **Given**: 存在 `/shared/` 源文件和 `client/assets/scripts/shared/` 目标目录
- **When**: 执行 `npm run sync:shared`
- **Then**: 
  - 复制 `/shared/*.ts` → `client/assets/scripts/shared/*.ts`
  - 保留 `.meta` 文件不变（Cocos Creator 资源 UUID）
  - 输出同步日志：`✓ Synced 3 files: CardEncoding.ts, CardPattern.ts, PatternHelper.ts`

### AC-2: package.json 集成
- **Given**: `client/package.json`
- **When**: 开发者执行 `npm install`
- **Then**: 
  - `postinstall` hook 自动执行 `npm run sync:shared`
  - 输出提示：`[postinstall] Auto-syncing /shared/ → client/assets/scripts/shared/`

### AC-3: 预编译 hook
- **Given**: 开发者准备启动 Cocos Creator 或构建项目
- **When**: 执行 `npm run prebuild` 或 `npm run dev`
- **Then**: 
  - `predev` / `prebuild` hook 自动执行 `npm run sync:shared`
  - 确保最新 shared 代码已同步

### AC-4: 文件一致性检查
- **Given**: 同步脚本完成
- **When**: 比较 `/shared/*.ts` 与 `client/assets/scripts/shared/*.ts`
- **Then**: 
  - 内容完全一致（逐字节比较）
  - `.meta` 文件时间戳不变

### AC-5: 文档更新
- **Given**: `client/CLAUDE.md`
- **When**: 阅读"shared 层导入规则"章节
- **Then**: 
  - 说明 `client/assets/scripts/shared/` 由脚本自动同步，禁止手动编辑
  - 提示：修改 `/shared/` 后需执行 `npm run sync:shared`
  - 移除"只读"标记，改为"自动同步目标，禁止手动改动"

### AC-6: 测试验证
- **Given**: 同步脚本已配置
- **When**: 执行 `npm test`
- **Then**: 
  - 客户端测试全绿：145/145 passed
  - 无导入路径错误

---

## 🛠️ 实现方案

### 技术栈
- **语言**: Node.js (JavaScript)
- **工具**: `fs`, `path` 内置模块
- **集成**: npm scripts hooks

### 脚本结构

```javascript
// client/scripts/sync-shared.js
const fs = require('fs');
const path = require('path');

const SOURCE = path.resolve(__dirname, '../../shared');
const TARGET = path.resolve(__dirname, '../assets/scripts/shared');

const FILES = ['CardEncoding.ts', 'CardPattern.ts', 'PatternHelper.ts'];

console.log('[sync:shared] Syncing /shared/ → client/assets/scripts/shared/...');

let syncedCount = 0;
for (const file of FILES) {
  const src = path.join(SOURCE, file);
  const dest = path.join(TARGET, file);
  
  if (!fs.existsSync(src)) {
    console.error(`  ✗ Source not found: ${file}`);
    process.exit(1);
  }
  
  fs.copyFileSync(src, dest);
  syncedCount++;
}

console.log(`  ✓ Synced ${syncedCount} files: ${FILES.join(', ')}`);
```

### package.json 配置

```json
{
  "scripts": {
    "sync:shared": "node scripts/sync-shared.js",
    "postinstall": "npm run sync:shared",
    "predev": "npm run sync:shared",
    "prebuild": "npm run sync:shared"
  }
}
```

---

## 📊 成本效益

### 当前成本（方案 A: 副本）
- 手动同步：5 分钟/次
- 遗漏风险：中（依赖人工记忆）
- 维护成本：持续性负担

### 方案 B 成本（预构建脚本）
- 开发成本：2.5 小时（一次性）
- 运行成本：<100ms/次（自动化，零心智负担）
- 维护成本：低（脚本稳定，仅在新增 shared 文件时更新 FILES 列表）

### ROI
- **首次收益点**: 同步 30 次后（30 × 5min = 2.5h）
- **长期收益**: 消除人工错误 + 团队协作摩擦

---

## 🚨 风险与限制

### 风险
1. **`.meta` 文件覆盖**: 如果脚本错误覆盖 `.meta`，Cocos Creator 资源 UUID 会丢失
   - **缓解**: 脚本仅复制 `.ts` 文件，不触碰 `.meta`

2. **Source of Truth 混淆**: 开发者可能误改 `client/assets/scripts/shared/` 而非 `/shared/`
   - **缓解**: 文档明确标注，code review 检查

### 限制
1. **不支持热重载**: 修改 `/shared/` 后需手动执行 `npm run sync:shared`
   - **未来优化**: 可添加文件监听（`chokidar`）实现自动同步

2. **新增文件需更新脚本**: 新增 shared 文件时需手动更新 `FILES` 列表
   - **未来优化**: 可改为自动扫描 `/shared/*.ts`

---

## 📝 测试计划

### 单元测试（手动验证）
1. 执行 `npm run sync:shared`，验证输出日志
2. 比较 `/shared/CardEncoding.ts` 与 `client/assets/scripts/shared/CardEncoding.ts` 内容一致性
3. 检查 `.meta` 文件时间戳未变化

### 集成测试
1. 修改 `/shared/PatternHelper.ts`（添加注释）
2. 执行 `npm run sync:shared`
3. 运行 `npm test`，验证测试通过
4. 在 Cocos Creator 中预览，验证脚本编译无错误

---

## ✅ 完成标准

- [ ] `client/scripts/sync-shared.js` 实现并测试通过
- [ ] `client/package.json` 集成 postinstall/predev/prebuild hooks
- [ ] 执行 `npm run sync:shared`，输出正确日志
- [ ] 执行 `npm test`，145/145 passed
- [ ] Cocos Creator 预览无脚本错误
- [ ] `client/CLAUDE.md` 文档更新
- [ ] `.tasks/done.md` 标记完成

---

## 📚 参考

- **原始需求**: specs/shared-deduplication.md
- **技术决策**: .tasks/blocked.md TASK-051 决策记录
- **npm scripts**: https://docs.npmjs.com/cli/v9/using-npm/scripts
