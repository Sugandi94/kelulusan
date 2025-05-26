const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const userRoute = require('./routes/user');
const adminRoute = require('./routes/admin');
const superadminRoute = require('./routes/superadmin');
const logger = require('./middleware/logger');
const errorHandler = require('./middleware/errorHandler');

const path = require('path');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

app.use(logger); // Logging aktivitas

app.use('/api/user', userRoute);
app.use('/ss', adminRoute);
app.use('/superadmin', superadminRoute);

// Landing page serving index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use(errorHandler);

const fs = require('fs');
const uploadsDir = 'uploads';

// Ensure uploads directory exists
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

const PORT = process.env.PORT || 3000;
app.listen(PORT)
  .on('listening', () => console.log(`Server ready at port ${PORT}`))
  .on('error', (err) => {
    console.error('Server failed to start:', err);
    process.exit(1);
  });
