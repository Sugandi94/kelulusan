const fs = require('fs');
const path = require('path');
const logPath = path.join(__dirname, '../data/log.json');

function logger(req, res, next) {
  const logs = fs.existsSync(logPath) ? JSON.parse(fs.readFileSync(logPath)) : [];
  const entry = {
    time: new Date().toISOString(),
    method: req.method,
    url: req.originalUrl,
    body: req.method === 'POST' || req.method === 'PUT' ? req.body : undefined,
    user: req.user ? req.user.username : null,
    ip: req.ip
  };
  logs.push(entry);
  fs.writeFileSync(logPath, JSON.stringify(logs, null, 2));
  next();
}

module.exports = logger;