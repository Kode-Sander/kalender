# Dr.Dropin Kalender

En moderne kalenderapplikasjon for Dr.Dropin med Node.js backend og SQLite database.

## Prosjektstruktur

```
/kalender
  ├── public/
  │   ├── index.html      # HTML-struktur
  │   ├── styles.css      # All CSS styling
  │   └── script.js       # Frontend JavaScript med API-integrasjon
  ├── server/
  │   ├── server.js       # Node.js Express backend
  │   └── database.sqlite # SQLite database (genereres automatisk)
  ├── package.json        # Prosjektavhengigheter
  ├── .gitignore         # Git ignore konfigurasjon
  └── README.md          # Denne filen
```

## Installasjon

1. Installer avhengigheter:
```bash
npm install
```

## Kjøring

Start serveren:
```bash
npm start
```

Serveren vil starte på `http://localhost:3000`

For utvikling med automatisk restart ved kodeendringer:
```bash
npm run dev
```

## API Endpoints

Backend tilbyr følgende REST API endpoints:

- **GET /api/appointments** - Hent alle avtaler
- **POST /api/appointments** - Opprett ny avtale
  - Body: `{ day, start, end, patient, type }`
- **DELETE /api/appointments/:id** - Slett avtale

## Funksjoner

- ✅ Ukesvisning av kalender
- ✅ Opprett nye avtaler ved å klikke på kalenderen
- ✅ Rediger eksisterende avtaler
- ✅ Slett avtaler
- ✅ Persistent lagring i SQLite database
- ✅ Sanntids tidslinje-indikator
- ✅ Responsive design
- ✅ Arbeidstid-markering (08:00-16:00)

## Teknologi

- **Frontend**: Vanilla JavaScript, CSS3, HTML5
- **Backend**: Node.js, Express.js
- **Database**: SQLite3
- **Icons**: Lucide Icons

## Utvikling

Prosjektet bruker:
- `express` - Web server framework
- `sqlite3` - Database
- `cors` - Cross-Origin Resource Sharing
- `nodemon` - Automatisk restart ved kodeendringer (dev)

## Notater

- Database-filen (`server/database.sqlite`) opprettes automatisk ved første kjøring
- `node_modules/` og `database.sqlite` er ekskludert fra git
- Eksempeldata legges automatisk inn i databasen ved første oppstart
