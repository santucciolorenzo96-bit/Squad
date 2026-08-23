# Team Manager — Basket · Documento di Handoff

Questo documento serve per riprendere lo sviluppo in **Claude Code** (o qualunque altro ambiente)
senza perdere il contesto delle decisioni prese finora in chat.

---

## 1. Visione del progetto

App web per la gestione di **una singola squadra di basket amatoriale/dilettantistica**, pensata per
essere usata da più persone dello staff (dirigente, allenatore, chi segna le statistiche a bordocampo)
con ruoli e permessi diversi.

Non è un tool di scouting/analisi video (tipo Hudl) — è deliberatamente più semplice e mirato:
inserimento statistiche live durante la partita, gestione rosa, home con lo stato della squadra,
classifica e calendario.

## 2. Stato di avanzamento

| Fase | Contenuto | Stato |
|---|---|---|
| Fase 1 | Setup squadra (nome, logo, colori), login, ruoli/permessi (Admin, Allenatore, Segnapunti), rosa persistente | ✅ Fatto |
| Fase 2 | Home con dati reali (prossima partita, ultimo risultato/MVP, leader stagionali, classifica), tab Statistiche, tab Classifica | ✅ Fatto |
| Fase 3 | Calendario campionato caricato da PDF con riconoscimento automatico + schermata di revisione | ⏳ Da fare |
| — | Match tracker live (tiri, rimbalzi, cambi, cronometro, box score, export CSV) | ✅ Fatto, integrato nella tab "Partita" |

## 3. Stack tecnico attuale

Un **singolo file HTML autonomo** (`index.html`): vanilla JS, nessun framework, nessun build step.
Scelta deliberata per restare portabile e semplice da ospitare ovunque (anche solo aprendo il file).

- Nessuna dipendenza esterna a runtime tranne i Google Fonts (via `@import`, con fallback di sistema
  se offline).
- Persistenza dati tramite un layer di storage astratto (`storageGet`/`storageSet`, vedi sezione 5).

**Se in Claude Code vuoi ristrutturare il progetto** (es. separare HTML/CSS/JS, introdurre un framework
come React/Vite), è del tutto ragionevole — l'importante è portare avanti il modello dati e la logica
di permessi descritti sotto.

## 4. Design system

```
Colori (personalizzabili da Admin in "Squadra", default arancione/nero):
  --bg:      #0B0D10   sfondo, fisso, non personalizzabile
  --panel:   #151920   pannelli
  --panel2:  #1C222B   pannelli secondari/input
  --line:    #262C36   bordi
  --text:    #F2F0EA   testo principale
  --dim:     #8B93A1   testo secondario
  --orange:  #FF6A13   ACCENTO PRIMARIO — personalizzabile (teamProfile.colors.primary)
  --gold:    #FFC53D   ACCENTO SECONDARIO — personalizzabile (teamProfile.colors.secondary)
  --green:   #2FB67C   fisso, semantico (azioni positive: canestro, assist...)
  --red:     #E5484D   fisso, semantico (errori, falli, palle perse...)

Font:
  --font-display: Manrope (700/800)   titoli, numeri grandi, hero
  --font-body:     Inter               testo UI, form
  --font-mono:     Roboto Mono         numeri tabellari (box score, cronometro)

Raggi: --radius 12px (componenti piccoli) · --radius-md 20px · --radius-lg 26px (card hero/home)
```

Riferimento visivo Home: screenshot fornito dall'utente (app di meditazione, mobile, sfondo scuro con
"glow" sfumati, card grandi arrotondate, gerarchia centrale forte). Applicato a: logo squadra centrale
+ posizione classifica, card grande prossima partita (le due squadre a confronto), card MVP ultima
partita, griglia di 4 mini-card statistiche.

## 5. Modello dati e persistenza

### Layer di storage
```js
const hasSharedStorage = !!(window.storage && window.storage.get && window.storage.set);
```
- **Dentro un artifact Claude.ai**: usa `window.storage.get/set(key, shared=true)` — dati condivisi
  tra tutti gli utenti che aprono l'artifact, persistenti.
- **Fuori da Claude.ai** (file aperto localmente, o hostato altrove): l'app fa fallback automatico su
  `localStorage` **non condiviso** — funziona solo sul singolo dispositivo/browser. L'app mostra un
  banner di avviso quando è in questa modalità.

⚠️ **Decisione chiave per il prossimo step**: se il progetto deve diventare un prodotto vero (accesso
da più dispositivi, dati persistenti in produzione, autenticazione robusta), questo layer va sostituito
con un backend reale. Opzioni ragionevoli per un progetto di questa scala:
- **Supabase** (Postgres + Auth + Storage, piano free generoso, setup rapido) — probabilmente la scelta
  più semplice per Lorenzo dato il contesto (portfolio data/analytics, già usa SQL).
- **Firebase** (Firestore + Auth) — alternativa altrettanto valida, più "no-SQL".
Il refactor consiste principalmente nel sostituire `storageGet`/`storageSet` con chiamate API/SDK equivalenti;
la logica applicativa sopra (ruoli, rendering, match tracker) non cambia concettualmente.

### Chiavi di storage (tutte `shared:true`)

| Chiave | Contenuto | Forma |
|---|---|---|
| `team_profile` | Dati squadra | `{name, city, category, logo: dataURL\|null, colors:{primary,secondary}, createdAt}` |
| `team_users` | Utenti/staff | `[{id, username, passwordHash, role, displayName}]` — `role` ∈ `admin`,`allenatore`,`segnapunti` |
| `team_roster` | Rosa giocatori persistente | `[{id, number, name}]` |
| `team_game_live` | Partita in corso (o stringa vuota) | vedi struttura sotto |
| `team_game_history` | Partite concluse | `[{id, oppName, teamScore, oppScore, date, quarter, players:[{number,name,pts,stats}]}]` |
| `team_next_match` | Prossima partita (o null) | `{opponent, date:"YYYY-MM-DD", time:"HH:MM", location, home:boolean}` |
| `team_standings` | Classifica campionato (manuale per ora) | `[{id, team, played, wins, losses, points, isUs:boolean}]` |

### Struttura partita (`liveGame` / voce di `history`)
```js
{
  oppName, quarterLength /*sec*/, numQuarters, quarter, clock /*sec*/, clockRunning,
  teamScore, oppScore, quarterFouls: {1: n, 2: n, ...},
  players: [{
    id, number, name, onCourt: boolean,
    stats: {
      fgm2, fga2, fgm3, fga3, ftm, fta,   // tiri
      orb, drb,                            // rimbalzi
      ast, stl,                            // playmaking/difesa
      tov, tovTypes: {generica, palleggio, passaggio, passi}, // palle perse per tipo
      blk, blkAgainst,                     // stoppate fatte/subite
      pf, pfDrawn,                         // falli commessi/subiti
      plusMinus, seconds                   // +/- e minuti giocati (secondi)
    }
  }]
}
```

### Sessione utente (locale, non condivisa)
`localStorage['bbapp_session'] = {userId}` — ogni dispositivo ricorda chi è loggato *su quel dispositivo*.

### Autenticazione
- Password hashate con **SHA-256** via `crypto.subtle` (fallback hash non crittografico se
  `crypto.subtle` non disponibile, es. contesti non sicuri).
- **Nessun salt**, **nessun recupero password via email** — l'Admin resetta le password degli altri
  utenti manualmente dal tab Utenti.
- Onesto avviso già dato all'utente: adeguato per un uso interno di squadra, **non** enterprise-grade.
  Se il progetto scala, va rivisto insieme al backend (punto sopra).

## 6. Modello permessi (ruoli)

| Tab | Admin | Allenatore | Segnapunti |
|---|---|---|---|
| Home | ✅ vedi, ✅ modifica prossima partita | ✅ vedi, ✅ modifica | ✅ solo vista |
| Rosa | ✅ | ✅ | ❌ |
| Partita (tracker live) | ✅ | ✅ | ✅ |
| Storico | ✅ | ✅ | ✅ |
| Statistiche | ✅ | ✅ | ✅ |
| Classifica | ✅ vedi+modifica | ✅ vedi+modifica | ✅ solo vista |
| Calendario | ✅ | ✅ | ❌ |
| Utenti | ✅ solo Admin | ❌ | ❌ |
| Squadra (profilo/colori) | ✅ solo Admin | ❌ | ❌ |

Filtraggio tab implementato in `TABS` (array con `roles: [...]`) + funzione `canSeeTab(tab)`.

## 7. Funzionalità già implementate (dettaglio)

- **Wizard primo avvio**: dati squadra + creazione account Admin.
- **Match tracker**: 5 slot "in campo" fissi, cambio tramite tap panchina → tap in campo da sostituire;
  statistiche complete (tiri 2/3/liberi separati, rimbalzi off/dif, assist, palle rubate, palle perse
  con sottotipo, stoppate fatte/subite, falli commessi/subiti); cronometro con minuti giocati
  auto-accumulati; +/- calcolato sui punti segnati/subiti mentre il giocatore è in campo; undo ultima
  azione (stack di snapshot); falli di squadra per periodo con indicatore bonus a 5; fine
  partita → salvataggio in `team_game_history`.
- **Box score**: live durante la partita e per ogni partita storica; export CSV; stampa/PDF via
  `window.print()` con stylesheet dedicato.
- **Home**: hero con logo+posizione classifica, card prossima partita (le due squadre a confronto,
  posizione classifica di entrambe se disponibile, countdown), card MVP ultima partita calcolata con
  la **Valutazione (IND)** ufficiale italiana:
  `IND = PT + REB_TOT + AST + STL + STOPPATE_FATTE + FALLI_SUBITI − TIRI_SBAGLIATI(2+3+TL) − PALLE_PERSE − FALLI_COMMESSI − STOPPATE_SUBITE`,
  4 mini-card (andamento stagione con striscia V/S, media punti squadra, miglior marcatore stagionale,
  countdown prossima partita).
- **Statistiche**: tabella stagionale aggregata per giocatore (PG, PT, PPG, REB, RPG, AST, APG, ST,
  stoppate, palle perse, minuti).
- **Classifica**: gestione manuale (in attesa di Fase 3), riga propria evidenziata.
- **Personalizzazione colori**: due color picker in "Squadra" che rifasano l'intera app via CSS custom
  properties (`--orange`, `--gold`) — nessun altro punto del codice va toccato per ri-tematizzare.

## 8. Fase 3 — Specifica per il calendario da PDF (da implementare)

**Obiettivo**: caricare il PDF del calendario federale e generare automaticamente le partite del
campionato, con revisione umana prima di confermare (i PDF federali italiani hanno formati troppo
variabili per un parsing 100% affidabile).

**Approccio consigliato**:
1. Estrazione testo dal PDF **lato client** con [PDF.js](https://mozilla.github.io/pdf.js/)
   (`https://cdnjs.cloudflare.com/ajax/libs/pdf.js/...`), niente backend necessario.
2. Parsing euristico del testo estratto: pattern per date (`\d{1,2}[/\.]\d{1,2}[/\.]\d{2,4}`), per
   coppie di squadre (spesso separate da "-" o "vs"), per numero di giornata.
3. **Schermata di revisione obbligatoria**: mostrare le partite riconosciute in una lista modificabile
   (aggiungi/correggi/elimina riga) prima di scrivere su `team_calendar` — mai fidarsi ciecamente
   dell'estrazione automatica.
4. Nuova chiave storage: `team_calendar` = `[{id, giornata, opponent, date, time, location, home,
   played:boolean, result:{teamScore,oppScore}|null}]`.
5. Collegamenti da fare col resto dell'app:
   - "Prossima partita" in Home può diventare **derivata automaticamente** dal calendario (prima
     partita non giocata in ordine di data) invece che inserita a mano — mantenendo comunque la
     possibilità di override manuale.
   - Classifica: valutare se calcolarla dai risultati del calendario invece che a mano (richiede sapere
     il sistema punti del campionato specifico — non è standardizzato in Italia, quindi probabilmente
     resterà comunque semi-manuale).

## 9. File inclusi in questo handoff

- `index.html` — l'app completa allo stato attuale (Fasi 1+2, match tracker incluso).
- `PROJECT_HANDOFF.md` — questo documento.

## 10. Contesto utente (per continuità di tono/decisioni)

Il progetto è di Lorenzo, sviluppato come attività personale/portfolio (ha un profilo ibrido
sales/data analytics, background in progetti self-contained HTML con localStorage). Preferisce
soluzioni dirette, non sovradimensionate, con compromessi spiegati onestamente invece che nascosti.
Comunica in italiano.
