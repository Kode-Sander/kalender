const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcrypt');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true
}));
app.use(express.json());
app.use(express.static(__dirname)); // Serve static files (HTML, CSS, JS)
app.use(session({
    secret: 'super-hemmelig-nokkel-endre-dette-i-produksjon',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Set to true if using HTTPS
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

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

// Add video_link column to appointments if it doesn't exist
db.run(`ALTER TABLE appointments ADD COLUMN video_link TEXT`, (err) => {
    if (!err) console.log("Added video_link column to appointments.");
});

// Add username and password columns to practitioners if they don't exist
db.run(`ALTER TABLE practitioners ADD COLUMN username TEXT`, (err) => {
    if (!err) console.log("Added username column to practitioners.");
});

db.run(`ALTER TABLE practitioners ADD COLUMN password TEXT`, (err) => {
    if (!err) {
        console.log("Added password column to practitioners.");
        // Create default admin user with hashed password
        const hash = bcrypt.hashSync('passord123', 10);
        db.run(`UPDATE practitioners SET username='admin', password=? WHERE id=1`, [hash], (updateErr) => {
            if (!updateErr) console.log("Created default admin user (username: admin, password: passord123)");
        });
    }
});

// Middleware for authentication
function isAuthenticated(req, res, next) {
    if (req.session.userId) {
        return next();
    }
    res.status(401).json({ error: 'Unauthorized' });
}

// API Routes

// Login route
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
    }

    db.get("SELECT * FROM practitioners WHERE username = ?", [username], async (err, user) => {
        if (err) {
            console.error('Error finding user:', err.message);
            return res.status(500).json({ error: 'Internal server error' });
        }

        if (!user) {
            return res.status(401).json({ error: 'Feil brukernavn' });
        }

        try {
            const match = await bcrypt.compare(password, user.password);
            if (match) {
                req.session.userId = user.id;
                req.session.userName = user.name;
                res.json({
                    message: 'Logget inn',
                    user: { id: user.id, name: user.name, role: user.role }
                });
            } else {
                res.status(401).json({ error: 'Feil passord' });
            }
        } catch (compareErr) {
            console.error('Error comparing passwords:', compareErr);
            res.status(500).json({ error: 'Internal server error' });
        }
    });
});

// Logout route
app.post('/api/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'Could not log out' });
        }
        res.json({ message: 'Logget ut' });
    });
});

// Check session route
app.get('/api/session', (req, res) => {
    if (req.session.userId) {
        res.json({
            authenticated: true,
            user: { id: req.session.userId, name: req.session.userName }
        });
    } else {
        res.json({ authenticated: false });
    }
});

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

// 2. Create new appointment with collision check (Protected)
app.post('/api/appointments', isAuthenticated, (req, res) => {
    const { start_time, end_time, patient, type, practitioner_id, video_link } = req.body;

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
        const insertSql = `INSERT INTO appointments (start_time, end_time, patient, type, practitioner_id, video_link) VALUES (?, ?, ?, ?, ?, ?)`;

        db.run(insertSql, [start_time, end_time, patient, type, practitioner_id, video_link], function(err) {
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
                practitioner_id,
                video_link
            });
        });
    });
});

// 3. Delete appointment (Protected)
app.delete('/api/appointments/:id', isAuthenticated, (req, res) => {
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

// Serve index.html for root path (with authentication check)
app.get('/', (req, res) => {
    if (!req.session.userId) {
        return res.sendFile(path.join(__dirname, 'login.html'));
    }
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
