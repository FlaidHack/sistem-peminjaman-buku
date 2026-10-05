USE catalog_db;
INSERT INTO books (id, title, author, category, status) VALUES
('B001','Pemrograman Web','Andi Setiawan','Pemrograman','available'),
('B002','Basis Data','Rina Wati','Basis Data','available'),
('B003','Jaringan Komputer','Dedi Kurniawan','Jaringan','available'),
('B004','Struktur Data dan Algoritma','Siti Nurhaliza','Pemrograman','available'),
('B005','Sistem Operasi','Bambang Susilo','Sistem','available'),
('B006','Rekayasa Perangkat Lunak','Maya Putri','Rekayasa','available'),
('B007','Kecerdasan Buatan','Fajar Rahman','AI','available'),
('B008','Keamanan Siber','Dewi Lestari','Keamanan','available'),
('B009','Machine Learning dengan Python','Agus Prasetyo','AI','available'),
('B010','Pemrograman Mobile Android','Rizky Ananda','Pemrograman','available'),
('B011','Cloud Computing','Sari Wulandari','Cloud','available'),
('B012','UI/UX Design','Gilang Ramadhan','Desain','available')
ON DUPLICATE KEY UPDATE title=VALUES(title), author=VALUES(author), category=VALUES(category);