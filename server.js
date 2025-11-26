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

// Create practitioners table
db.run(`CREATE TABLE IF NOT EXISTS practitioners (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    color TEXT NOT NULL
)`, () => {
    // Seed practitioners if table is empty
    db.get("SELECT count(*) as count FROM practitioners", (err, row) => {
        if (err) {
            console.error('Error checking practitioners:', err.message);
            return;
        }
        if (row.count === 0) {
            const stmt = db.prepare("INSERT INTO practitioners (name, role, color) VALUES (?, ?, ?)");
            stmt.run("Sander Rosøy", "Psykolog", "#ffe8d6");
            stmt.run("Ola Nordmann", "Lege", "#e6effc");
            stmt.run("Kari Olsen", "Fysioterapeut", "#e3fcef");
            stmt.finalize();
            console.log("Seeded practitioners database.");
        }
    });
});

// Add practitioner_id column to appointments if it doesn't exist
db.run(`ALTER TABLE appointments ADD COLUMN practitioner_id INTEGER`, (err) => {
    if (!err) console.log("Added practitioner_id column to appointments.");
});

// API Routes

// Get all practitioners
app.get('/api/practitioners', (req, res) => {
    db.all("SELECT * FROM practitioners", [], (err, rows) => {
        if (err) {
            console.error('Error fetching practitioners:', err.message);
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// 1. Get appointments for a specific period
app.get('/api/appointments', (req, res) => {
    const { start, end, practitionerId } = req.query;

    if (!start || !end) {
        return res.status(400).json({ error: 'Start and end parameters are required' });
    }

    let sql = "SELECT * FROM appointments WHERE start_time >= ? AND start_time <= ?";
    const params = [start, end];

    // Filter by practitioner if specified and not "all"
    if (practitionerId && practitionerId !== 'all') {
        sql += " AND practitioner_id = ?";
        params.push(practitionerId);
    }

    sql += " ORDER BY start_time";

    db.all(sql, params, (err, rows) => {
        if (err) {
            console.error('Error fetching appointments:', err.message);
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// 2. Create new appointment with collision check
app.post('/api/appointments', (req, res) => {
    const { start_time, end_time, patient, type, practitioner_id } = req.body;

    if (!start_time || !end_time || !patient || !type) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    // Check for collision: any appointment for the SAME practitioner that overlaps
    const checkSql = `
        SELECT id FROM appointments
        WHERE start_time < ? AND end_time > ? AND practitioner_id = ?
    `;

    db.get(checkSql, [end_time, start_time, practitioner_id], (err, row) => {
        if (err) {
            console.error('Error checking collision:', err.message);
            return res.status(500).json({ error: err.message });
        }

        if (row) {
            // Collision detected
            return res.status(409).json({ error: "Tidspunktet er opptatt for denne behandleren." });
        }

        // No collision, insert appointment
        const insertSql = `INSERT INTO appointments (start_time, end_time, patient, type, practitioner_id) VALUES (?, ?, ?, ?, ?)`;

        db.run(insertSql, [start_time, end_time, patient, type, practitioner_id], function(err) {
            if (err) {
                console.error('Error inserting appointment:', err.message);
                return res.status(500).json({ error: err.message });
            }
            res.status(201).json({
                id: this.lastID,
                start_time,
                end_time,
                patient,
                type,
                practitioner_id
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
    console.log(`  GET    /api/practitioners`);
    console.log(`  GET    /api/appointments?start=<ISO>&end=<ISO>&practitionerId=<ID>`);
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
