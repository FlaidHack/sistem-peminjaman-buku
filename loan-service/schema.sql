CREATE DATABASE IF NOT EXISTS loan_db CHARACTER SET utf8mb4;
USE loan_db;
CREATE TABLE IF NOT EXISTS loans (
  id VARCHAR(50) PRIMARY KEY,
  student_id VARCHAR(20) NOT NULL,
  book_id VARCHAR(10) NOT NULL,
  borrow_date DATE NOT NULL,
  due_date DATE NOT NULL,
  INDEX idx_student (student_id),
  INDEX idx_book (book_id)
) ENGINE=InnoDB;