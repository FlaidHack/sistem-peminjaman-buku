// Proteksi direct call: semua route loan-service wajib header x-api-key.
// Frontend tidak tahu key; gateway meng-inject key setelah verify JWT.
function requireApiKey(req, res, next) {
  const expected = process.env.LOAN_API_KEY;
  const got = req.headers['x-api-key'];

  if (!expected || got !== expected) {
    return res.status(401).json({ success: false, message: 'Unauthorized: x-api-key tidak valid' });
  }
  next();
}

module.exports = requireApiKey;