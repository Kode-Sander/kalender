# Dr.Dropin Kalender

En smart kalender-applikasjon med dynamisk uke-navigasjon og kollisjonssjekk for avtaler.

## Funksjoner

- ✅ **Dynamisk uke-navigasjon**: Naviger mellom uker og hopp til dagens dato
- ✅ **Kollisjonssjekk**: Forhindrer dobbeltbooking av tidspunkter
- ✅ **Full dato-støtte**: Bruker ISO8601 tidsstempler for presis tidsplanlegging
- ✅ **Responsivt design**: Moderne UI med Dr.Dropin branding
- ✅ **Sanntids tidsviser**: Rød linje viser nåværende tid

## Teknologi

- **Frontend**: Vanilla JavaScript, CSS3, HTML5
- **Backend**: Node.js, Express.js
- **Database**: SQLite3
- **Ikoner**: Lucide Icons

## Installasjon

1. Installer avhengigheter:
```bash
npm install
```

2. Start serveren:
```bash
npm start
```

3. Åpne nettleseren på:
```
http://localhost:3000
```

## Bruk

### Lage ny avtale
- Klikk på et tidspunkt i kalenderen
- Fyll inn pasient-informasjon og velg konsultasjonstype
- Klikk "Lagre"

### Navigere uker
- Bruk pil-knappene for å gå frem/tilbake
- Klikk "Today" for å hoppe til inneværende uke

### Redigere/slette avtale
- Klikk på en eksisterende avtale
- Endre informasjon eller klikk "Slett"

## API Endepunkter

- `GET /api/appointments?start=<ISO>&end=<ISO>` - Hent avtaler for periode
- `POST /api/appointments` - Opprett ny avtale
- `DELETE /api/appointments/:id` - Slett avtale

## Utvikling

For automatisk restart ved endringer:
```bash
npm run dev
```

## Struktur

```
kalender/
├── index.html       # Hovedside
├── styles.css       # Styling
├── script.js        # Frontend-logikk
├── server.js        # Backend API
├── package.json     # Dependencies
└── calendar.db      # SQLite database (genereres automatisk)
```

## Kollisjonssjekk

Serveren sjekker automatisk for tidskonflikter:
- En ny avtale kan ikke starte før en eksisterende slutter
- En ny avtale kan ikke slutte etter en eksisterende starter
- Ved kollisjon returneres HTTP 409 Conflict

## Lisens

Proprietary - Dr.Dropin Norway
