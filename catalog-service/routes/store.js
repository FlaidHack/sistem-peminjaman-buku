const fs = require('fs');
const path = require('path');

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw || '[]');
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
}

const usersFile = path.join(__dirname, '..', 'data', 'users.json');
const booksFile = path.join(__dirname, '..', 'data', 'books.json');

module.exports = { readJson, writeJson, usersFile, booksFile };
