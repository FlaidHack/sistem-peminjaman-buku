CREATE DATABASE IF NOT EXISTS catalog_db CHARACTER SET utf8mb4;
USE catalog_db;
CREATE TABLE IF NOT EXISTS books (
  id VARCHAR(10) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  author VARCHAR(255) NOT NULL,
  category VARCHAR(100) DEFAULT 'Umum',
  status ENUM('available','borrowed') NOT NULL DEFAULT 'available'
) ENGINE=InnoDB;