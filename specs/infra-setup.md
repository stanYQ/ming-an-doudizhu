# Spec: 基础设施搭建 InfraSetup

**任务 ID**: TASK-004  
**目标模块**: infra  
**优先级**: P0  
**状态**: ready

---

## 背景

来源：TDD v1.0 第六章（数据库设计）+ 第七章（服务器部署）。搭建本地/生产开发环境所需的全部基础设施骨架：4张 MySQL 表、Redis 键命名规范、Docker Compose 编排、Nginx WSS 转发配置。P0 阶段完成后，server-dev 和 client-dev 可在统一环境中联调。

## 验收标准

### MySQL DDL

- AC-1: 执行所有 DDL 无报错，`SHOW TABLES` 返回 4 张表：`users` `game_records` `game_players` `orders`
- AC-2: `users` 表包含字段：`id` `openid` `nickname` `avatar_url` `score` `rank_level` `coin` `diamond` `total_games` `win_games` `created_at` `updated_at`；`openid` 有唯一索引
- AC-3: `game_records` 表包含字段：`id` `room_id` `winner_camp` `landlord_id` `partner_id`（可 NULL）`code_card` `is_alone` `first_out_id` `multiplier` `duration` `created_at`
- AC-4: `game_players` 表包含字段：`id` `record_id` `user_id` `role` `rank_pos` `score_delta` `coin_delta`
- AC-5: `orders` 表包含字段：`id` `order_no` `user_id` `product_id` `amount` `status` `created_at` `paid_at`；`order_no` 有唯一索引
- AC-6: 所有表使用 `ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`

### Redis 键

- AC-7: 文档中定义的 5 类 Redis 键名模式与 TTL 与下方规范一致（代码中 key 生成不得 hardcode 字符串，须使用常量）

### Docker Compose

- AC-8: `docker compose up -d` 启动后，`docker compose ps` 显示 4 个服务均为 running：`nginx` `game-server` `mysql` `redis`
- AC-9: mysql 数据卷（`mysql-data`）和 redis 数据卷（`redis-data`）均已声明，容器重启不丢数据
- AC-10: `game-server` 服务依赖 `redis` 和 `mysql`（`depends_on` 已配置）
- AC-11: `nginx` 服务依赖 `game-server`，暴露端口 80 和 443

### Nginx WSS

- AC-12: Nginx 配置包含 `proxy_http_version 1.1`、`Upgrade` 和 `Connection: upgrade` header，WebSocket 握手可正常通过
- AC-13: `proxy_read_timeout` 设置为 600s（支持长连接对局）
- AC-14: SSL 证书路径配置为 `/etc/nginx/certs/fullchain.pem` 和 `privkey.pem`（占位，实际部署时挂载）
- AC-15: 微信小程序合规要求注释在 nginx.conf 中注明（须 HTTPS/WSS + 域名备案）

## 接口 / 数据结构

### Redis 键命名规范

```typescript
// 使用常量，禁止 hardcode 字符串
export const RedisKeys = {
  room:        (id: string)   => `room:${id}`,          // String(JSON)，房间快照，TTL=对局期
  session:     (sid: string)  => `session:${sid}`,      // Hash，玩家会话，TTL=86400s
  leaderboard: ()             => `rank:leaderboard`,    // ZSet，按积分，永久
  matchQueue:  (tier: string) => `match:queue:${tier}`, // List，分段匹配，TTL=动态
  onlineCount: ()             => `online:count`,        // String，实时在线数，无TTL
} as const;
```

### MySQL DDL（完整）

```sql
CREATE TABLE users (
  id           BIGINT PRIMARY KEY AUTO_INCREMENT,
  openid       VARCHAR(64)  NOT NULL UNIQUE,
  nickname     VARCHAR(32)  NOT NULL,
  avatar_url   VARCHAR(255),
  score        INT          NOT NULL DEFAULT 1000,
  rank_level   VARCHAR(16)  DEFAULT 'bronze',
  coin         BIGINT       NOT NULL DEFAULT 0,
  diamond      INT          NOT NULL DEFAULT 0,
  total_games  INT          NOT NULL DEFAULT 0,
  win_games    INT          NOT NULL DEFAULT 0,
  created_at   DATETIME     DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_score  (score),
  INDEX idx_openid (openid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE game_records (
  id           BIGINT PRIMARY KEY AUTO_INCREMENT,
  room_id      VARCHAR(32)  NOT NULL,
  winner_camp  TINYINT      NOT NULL,         -- 0=平民 1=地主阵营
  landlord_id  BIGINT       NOT NULL,
  partner_id   BIGINT       NULL,             -- NULL 表示一挑四
  code_card    VARCHAR(16),                   -- 如 heart_7
  is_alone     TINYINT      NOT NULL DEFAULT 0,
  first_out_id BIGINT       NOT NULL,
  multiplier   INT          NOT NULL DEFAULT 1,
  duration     INT          NOT NULL,         -- 秒
  created_at   DATETIME     DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_landlord (landlord_id),
  INDEX idx_created  (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE game_players (
  id          BIGINT PRIMARY KEY AUTO_INCREMENT,
  record_id   BIGINT       NOT NULL,
  user_id     BIGINT       NOT NULL,
  role        VARCHAR(16)  NOT NULL,          -- landlord/partner/civilian
  rank_pos    TINYINT      NOT NULL,          -- 出完名次 1-5
  score_delta INT          NOT NULL,
  coin_delta  INT          NOT NULL DEFAULT 0,
  INDEX idx_user   (user_id),
  INDEX idx_record (record_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE orders (
  id         BIGINT PRIMARY KEY AUTO_INCREMENT,
  order_no   VARCHAR(64)  NOT NULL UNIQUE,
  user_id    BIGINT       NOT NULL,
  product_id VARCHAR(32)  NOT NULL,
  amount     INT          NOT NULL,           -- 分
  status     TINYINT      NOT NULL DEFAULT 0, -- 0待付 1成功 2失败
  created_at DATETIME     DEFAULT CURRENT_TIMESTAMP,
  paid_at    DATETIME     NULL,
  INDEX idx_user   (user_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### docker-compose.yml 骨架

```yaml
version: "3.8"
services:
  nginx:
    image: nginx:alpine
    ports: ["80:80", "443:443"]
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./certs:/etc/nginx/certs
    depends_on: [game-server]

  game-server:
    build: ./server
    environment:
      - NODE_ENV=production
      - REDIS_URL=redis://redis:6379
      - MYSQL_HOST=mysql
    depends_on: [redis, mysql]
    restart: always

  mysql:
    image: mysql:8.0
    environment:
      - MYSQL_ROOT_PASSWORD=changeme
      - MYSQL_DATABASE=ddz
    volumes: ["mysql-data:/var/lib/mysql"]

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes: ["redis-data:/data"]

volumes:
  mysql-data:
  redis-data:
```

### Nginx WSS 配置要点

```nginx
server {
  listen 443 ssl;
  server_name your.domain;

  ssl_certificate     /etc/nginx/certs/fullchain.pem;
  ssl_certificate_key /etc/nginx/certs/privkey.pem;

  # 微信小程序要求：HTTPS/WSS + 域名备案 + 小程序后台配置 socket 合法域名
  location / {
    proxy_pass         http://game-server:2567;
    proxy_http_version 1.1;
    proxy_set_header   Upgrade    $http_upgrade;
    proxy_set_header   Connection "upgrade";
    proxy_set_header   Host       $host;
    proxy_read_timeout 600s;
  }
}
```

## 约束

- DDL 必须可在 MySQL 8.0 上无警告执行
- Redis 键名只能通过 `RedisKeys` 常量生成，不得在业务代码中拼接字符串
- `MYSQL_ROOT_PASSWORD=changeme` 仅用于本地开发，生产部署须替换为环境变量注入
- SSL 证书文件不进入版本库（`.gitignore` 须包含 `certs/`）

## 不在范围内

- PM2 生产调优（`ecosystem.config.js` 的 `instances` / `max_memory_restart` 调整）
- CI/CD 流水线（P3 阶段写）
- 数据库迁移工具（如 Flyway / Liquibase）集成
- Redis Cluster / MySQL 主从配置（单机阶段不需要）

## 测试要求

- 单元测试：对 `RedisKeys` 常量函数做参数化测试（AC-7）
- 集成测试（手动验收）：
  - `docker compose up -d` → `docker compose ps` 检查（AC-8）
  - 执行 DDL SQL → `SHOW TABLES` + `DESCRIBE` 检查（AC-1 至 AC-6）
  - wscat / Postman 发 WebSocket 握手，确认 Nginx 透传（AC-12 至 AC-13）
- 错误路径：`MYSQL_ROOT_PASSWORD` 未设置时 mysql 容器应启动失败并打印明确错误
