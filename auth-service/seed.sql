USE auth_db;
INSERT INTO users (id, name, password_hash) VALUES
('MHS001','Ahmad Fadil','$2b$10$SNRuY3RvWGT7IVtdOxqDaePjeYduQppDYDyg/qSLySm0UUf5rIPQ2'),
('MHS002','Budi Santoso','$2b$10$SNRuY3RvWGT7IVtdOxqDaePjeYduQppDYDyg/qSLySm0UUf5rIPQ2'),
('MHS003','Citra Dewi','$2b$10$SNRuY3RvWGT7IVtdOxqDaePjeYduQppDYDyg/qSLySm0UUf5rIPQ2')
ON DUPLICATE KEY UPDATE name=VALUES(name);
