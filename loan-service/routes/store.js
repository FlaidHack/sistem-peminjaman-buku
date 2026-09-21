const fs = require('fs');
const path = require('path');

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw || '[]');
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
}

const loansFile = path.join(__dirname, '..', 'data', 'loans.json');
const MAX_LOANS = 3;
const BORROW_DAYS = 7;

module.exports = { readJson, writeJson, loansFile, MAX_LOANS, BORROW_DAYS };
