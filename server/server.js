const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

// Opprett database
const db = new sqlite3.Database('./server/database.sqlite', (err) => {
    if (err) {
        console.error('Database connection error:', err.message);
    } else {
        console.log('Connected to SQLite database.');
    }
});

// Lag tabell hvis den ikke finnes
db.run(`CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    day INTEGER NOT NULL,
    start TEXT NOT NULL,
    end TEXT NOT NULL,
    patient TEXT NOT NULL,
    type TEXT NOT NULL
)`, (err) => {
    if (err) {
        console.error('Table creation error:', err.message);
    } else {
        console.log('Appointments table ready.');

        // Legg til noen eksempel-data hvis tabellen er tom
        db.get("SELECT COUNT(*) as count FROM appointments", [], (err, row) => {
            if (!err && row.count === 0) {
                console.log('Adding sample appointments...');
                const sampleData = [
                    { day: 0, start: '09:00', end: '10:00', patient: 'J*** P***', type: 'Psykolog i klinikk, oppfølging' },
                    { day: 0, start: '10:00', end: '11:00', patient: 'E*** L***', type: 'Psykolog i klinikk, oppfølging' },
                    { day: 2, start: '08:30', end: '09:30', patient: 'E*** K***', type: 'Psykolog i klinikk, oppfølging' },
                    { day: 2, start: '11:00', end: '12:00', patient: 'K*** P***', type: 'Psykolog i klinikk, oppfølging' },
                    { day: 2, start: '13:00', end: '14:00', patient: 'Ø*** S***', type: 'Psykolog i klinikk, oppfølging' }
                ];

                const stmt = db.prepare(`INSERT INTO appointments (day, start, end, patient, type) VALUES (?, ?, ?, ?, ?)`);
                sampleData.forEach(appt => {
                    stmt.run([appt.day, appt.start, appt.end, appt.patient, appt.type]);
                });
                stmt.finalize();
                console.log('Sample appointments added.');
            }
        });
    }
});

// API Routes

// 1. Hent alle avtaler
app.get('/api/appointments', (req, res) => {
    db.all("SELECT * FROM appointments ORDER BY day, start", [], (err, rows) => {
        if (err) {
            console.error('Error fetching appointments:', err.message);
            return res.status(500).json({error: err.message});
        }
        res.json(rows);
    });
});

// 2. Lagre ny avtale
app.post('/api/appointments', (req, res) => {
    const { day, start, end, patient, type } = req.body;

    // Validering
    if (day === undefined || !start || !end || !patient || !type) {
        return res.status(400).json({ error: 'Mangler påkrevde felter' });
    }

    const sql = `INSERT INTO appointments (day, start, end, patient, type) VALUES (?, ?, ?, ?, ?)`;
    db.run(sql, [day, start, end, patient, type], function(err) {
        if (err) {
            console.error('Error creating appointment:', err.message);
            return res.status(500).json({error: err.message});
        }
        res.json({ id: this.lastID, day, start, end, patient, type });
    });
});

// 3. Slett avtale
app.delete('/api/appointments/:id', (req, res) => {
    const sql = `DELETE FROM appointments WHERE id = ?`;
    db.run(sql, req.params.id, function(err) {
        if (err) {
            console.error('Error deleting appointment:', err.message);
            return res.status(500).json({error: err.message});
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Avtale ikke funnet' });
        }
        res.json({ message: "Deleted", changes: this.changes });
    });
});

// Serve index.html for root path
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Calendar available at http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err.message);
        } else {
            console.log('Database connection closed.');
        }
        process.exit(0);
    });
});
