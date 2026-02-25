CREATE DATABASE IF NOT EXISTS growing_seed
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE growing_seed;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('user', 'admin') NOT NULL DEFAULT 'user',
  view_mode ENUM('user', 'admin') NOT NULL DEFAULT 'user',
  joined_date DATE NULL,
  last_login DATETIME NULL,
  faith_points INT NOT NULL DEFAULT 0,
  tree_progress INT NOT NULL DEFAULT 0,
  passive_rate DECIMAL(10, 2) NOT NULL DEFAULT 1.00,
  fruit_count INT NOT NULL DEFAULT 0,
  points_for_fruit INT NOT NULL DEFAULT 0,
  max_bloom_reached TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
);

CREATE TABLE IF NOT EXISTS user_task_completions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  task_key VARCHAR(40) NOT NULL,
  period_key VARCHAR(32) NOT NULL,
  completed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_user_task_period (user_id, task_key, period_key),
  KEY idx_user_task (user_id, task_key),
  CONSTRAINT fk_task_completion_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS password_reset_requests (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  reset_code VARCHAR(20) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_password_reset_user (user_id),
  KEY idx_password_reset_code (reset_code),
  CONSTRAINT fk_password_reset_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_sessions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  user_agent VARCHAR(255) NULL,
  ip_address VARCHAR(45) NULL,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_session_token_hash (token_hash),
  KEY idx_sessions_user (user_id),
  CONSTRAINT fk_session_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
);

INSERT INTO users (name, email, password_hash, role, view_mode)
VALUES
  ('Admin', 'endlesssh0014@gmail.com', '$2b$10$replace-with-real-bcrypt-hash', 'admin', 'admin'),
  ('Admin', 'endlessssh0014@gmail.com', '$2b$10$replace-with-real-bcrypt-hash', 'admin', 'admin'),
  ('Admin', 'endless0014@gmail.com', '$2b$10$replace-with-real-bcrypt-hash', 'admin', 'admin')
ON DUPLICATE KEY UPDATE
  role = VALUES(role),
  view_mode = VALUES(view_mode),
  updated_at = CURRENT_TIMESTAMP;