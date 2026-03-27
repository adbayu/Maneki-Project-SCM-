const express = require('express');
const cors = require('cors');
require('dotenv').config();

const menuRoutes = require('./routes/menu');

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/menu', menuRoutes);

// Basic healthcheck
app.get('/health', (req, res) => {
    res.json({ status: 'OK', module: 'Menu Planning & Analisis Gizi' });
});

// Setup DB connection listener
const db = require('./db');
db.getConnection()
    .then((conn) => {
        console.log('Database connected successfully');
        conn.release();
    })
    .catch((err) => {
        console.error('Failed to connect to the database:', err.message);
    });

app.listen(PORT, () => {
    console.log(`Menu Planning backend is running on http://localhost:${PORT}`);
});
