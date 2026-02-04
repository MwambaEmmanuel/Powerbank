require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
const port = 3000;

// Middleware
app.use(cors()); // Allows your HTML file to talk to this server
app.use(express.json());

// Database Connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Check database connection on startup
(async () => {
    try {
        const client = await pool.connect();
        const res = await client.query('SELECT NOW()');
        console.log("Connected to Database Successfully at:", res.rows[0].now);

        // Create table if it doesn't exist
        await client.query(`
            CREATE TABLE IF NOT EXISTS news (
                id SERIAL PRIMARY KEY,
                headline TEXT NOT NULL,
                category TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("Table 'news' is ready.");
        client.release();
    } catch (err) {
        console.error("Database initialization error:", err);
    }
})();

// GET: Fetch all news (for index.html)
app.get('/api/news', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM news ORDER BY created_at DESC LIMIT 20');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST: Verify Admin Password
app.post('/api/login', (req, res) => {
    const { password } = req.body;
    console.log(`Login Attempt -> Input: '${password}' | Expected: '${process.env.ADMIN_PASSWORD}'`);
    if (password === process.env.ADMIN_PASSWORD) {
        res.json({ success: true });
    } else {
        res.status(401).json({ error: 'Invalid password' });
    }
});

// POST: Add new news (for admin.html)
app.post('/api/news', async (req, res) => {
    const adminPassword = req.headers['admin-password'];
    if (adminPassword !== process.env.ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Unauthorized: Incorrect password' });
    }
    const { headline, category, content } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO news (headline, category, content) VALUES ($1, $2, $3) RETURNING *',
            [headline, category, content]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});