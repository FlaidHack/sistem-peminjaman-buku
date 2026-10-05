require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'loan_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  // Kolom DATE dikembalikan sebagai string 'YYYY-MM-DD' (bukan objek Date)
  // supaya bentuk JSON loan sama dengan kontrak frontend & test lama.
  dateStrings: true
});

async function query(sql, params) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

module.exports = { pool, query };