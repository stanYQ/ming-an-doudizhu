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
  id               BIGINT PRIMARY KEY AUTO_INCREMENT,
  room_id          VARCHAR(32)  NOT NULL,
  table_type       VARCHAR(16)  NOT NULL DEFAULT 'casual',
  winner_camp      TINYINT      NOT NULL,
  landlord_id      BIGINT       NOT NULL,
  partner_id       BIGINT       NULL,
  code_card        VARCHAR(16),
  is_alone         TINYINT      NOT NULL DEFAULT 0,
  first_out_id     BIGINT       NOT NULL,
  multiplier       INT          NOT NULL DEFAULT 1,
  landlord_double  TINYINT      NOT NULL DEFAULT 1,
  duration         INT          NOT NULL,
  created_at       DATETIME     DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_landlord  (landlord_id),
  INDEX idx_created   (created_at),
  INDEX idx_tabletype (table_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE game_players (
  id           BIGINT PRIMARY KEY AUTO_INCREMENT,
  record_id    BIGINT       NOT NULL,
  user_id      BIGINT       NOT NULL,
  session_id   VARCHAR(64)  NOT NULL,
  role         VARCHAR(16)  NOT NULL DEFAULT 'civilian',
  rank_pos     TINYINT      NOT NULL,
  score_delta  INT          NOT NULL,
  double_value TINYINT      NOT NULL DEFAULT 1,
  coin_delta   INT          NOT NULL DEFAULT 0,
  INDEX idx_user   (user_id),
  INDEX idx_record (record_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE checkin_records (
  id           BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id      BIGINT      NOT NULL,
  checkin_date DATE        NOT NULL,
  streak       INT         NOT NULL DEFAULT 1,
  score_gained INT         NOT NULL DEFAULT 0,
  created_at   DATETIME    DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_date (user_id, checkin_date),
  INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE orders (
  id         BIGINT PRIMARY KEY AUTO_INCREMENT,
  order_no   VARCHAR(64)  NOT NULL UNIQUE,
  user_id    BIGINT       NOT NULL,
  product_id VARCHAR(32)  NOT NULL,
  amount     INT          NOT NULL,
  status     TINYINT      NOT NULL DEFAULT 0,
  created_at DATETIME     DEFAULT CURRENT_TIMESTAMP,
  paid_at    DATETIME     NULL,
  INDEX idx_user   (user_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
