const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const userRoute = require('./routes/user');
const adminRoute = require('./routes/admin');
const logger = require('./middleware/logger');
const errorHandler = require('./middleware/errorHandler');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

app.use(logger); // Logging aktivitas

app.use('/api/user', userRoute);
app.use('/api/admin', adminRoute);

// Landing API info
app.get('/', (req, res) => {
  res.json({
    message: "API Cek Kelulusan siap digunakan! Lihat /public/index.html atau /public/admin.html"
  });
});

app.use(errorHandler);

app.listen(3000, () => console.log('Server ready at http://localhost:3000'));