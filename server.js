const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname)); // Serve static files (HTML, CSS, JS)

// Database setup
const db = new sqlite3.Database('./calendar.db', (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to SQLite database');
    }
});

// Create table with full timestamps
db.run(`CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    patient TEXT NOT NULL,
    type TEXT NOT NULL
)`);

// API Routes

// 1. Get appointments for a specific period
app.get('/api/appointments', (req, res) => {
    const { start, end } = req.query;

    if (!start || !end) {
        return res.status(400).json({ error: 'Start and end parameters are required' });
    }

    const sql = "SELECT * FROM appointments WHERE start_time >= ? AND start_time <= ? ORDER BY start_time";

    db.all(sql, [start, end], (err, rows) => {
        if (err) {
            console.error('Error fetching appointments:', err.message);
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// 2. Create new appointment with collision check
app.post('/api/appointments', (req, res) => {
    const { start_time, end_time, patient, type } = req.body;

    if (!start_time || !end_time || !patient || !type) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    // Check for collision: any appointment that starts before this one ends AND ends after this one starts
    const checkSql = `
        SELECT id FROM appointments
        WHERE start_time < ? AND end_time > ?
    `;

    db.get(checkSql, [end_time, start_time], (err, row) => {
        if (err) {
            console.error('Error checking collision:', err.message);
            return res.status(500).json({ error: err.message });
        }

        if (row) {
            // Collision detected
            return res.status(409).json({ error: "Tidspunktet er opptatt." });
        }

        // No collision, insert appointment
        const insertSql = `INSERT INTO appointments (start_time, end_time, patient, type) VALUES (?, ?, ?, ?)`;

        db.run(insertSql, [start_time, end_time, patient, type], function(err) {
            if (err) {
                console.error('Error inserting appointment:', err.message);
                return res.status(500).json({ error: err.message });
            }
            res.status(201).json({
                id: this.lastID,
                start_time,
                end_time,
                patient,
                type
            });
        });
    });
});

// 3. Delete appointment
app.delete('/api/appointments/:id', (req, res) => {
    const { id } = req.params;

    const sql = "DELETE FROM appointments WHERE id = ?";

    db.run(sql, [id], function(err) {
        if (err) {
            console.error('Error deleting appointment:', err.message);
            return res.status(500).json({ error: err.message });
        }

        if (this.changes === 0) {
            return res.status(404).json({ error: 'Appointment not found' });
        }

        res.json({ message: 'Appointment deleted successfully', id: parseInt(id) });
    });
});

// Serve index.html for root path
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log('API endpoints:');
    console.log(`  GET    /api/appointments?start=<ISO>&end=<ISO>`);
    console.log(`  POST   /api/appointments`);
    console.log(`  DELETE /api/appointments/:id`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err.message);
        } else {
            console.log('\nDatabase connection closed');
        }
        process.exit(0);
    });
});
