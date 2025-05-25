const jwt = require('jsonwebtoken');
const SECRET_KEY = 'your_super_secret_key'; // Ganti dengan .env untuk produksi

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ message: 'Token diperlukan' });
  const token = authHeader.replace('Bearer ', '');
  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.status(403).json({ message: 'Token tidak valid' });
    req.user = user;
    next();
  });
}
module.exports = { authenticateToken, SECRET_KEY };