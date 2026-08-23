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
| Fase 2.5 | **Migrazione backend**: da `window.storage`/`localStorage` a Supabase (Postgres+Auth+Storage), ristrutturazione da singolo file a progetto Vite modulare | ✅ Fatto (codice pronto, in attesa di credenziali Supabase reali per il collaudo funzionale completo) |
| Fase 3 | Calendario campionato caricato da PDF con riconoscimento automatico + schermata di revisione | ⏳ Da fare |
| — | Match tracker live (tiri, rimbalzi, cambi, cronometro, box score, export CSV) | ✅ Fatto, integrato nella tab "Partita" |

## 3. Stack tecnico attuale

Il progetto è stato ristrutturato da un singolo file HTML (`files/index.html`, mantenuto come
riferimento storico/pre-refactor) a un **progetto Vite** in `app/`:

- **Frontend**: vanilla JS in moduli ES (nessun framework — scelta deliberata, coerente con lo
  spirito originale del progetto), Vite come dev server/bundler.
- **Backend**: Supabase — Postgres (dati), Auth (login email/password), Storage (loghi squadra).
- **Nessun dato di produzione da migrare**: lo storage precedente era solo locale/artifact, si è
  ripartiti puliti lato dati.

Struttura di `app/src/`:
```
supabaseClient.js       client Supabase (legge VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY da .env.local)
state.js                stato globale in-memory (equivalente alle variabili globali del file originale)
router.js                boot()/logout(), carica i dati del team dopo login
auth.js                  login, creazione squadra, ingresso con codice invito, cambio/reset password
api/                     funzioni CRUD verso le tabelle Supabase (teams, profiles, roster, games, ...)
ui/layout.js             shell app (header, tabbar, menu utente) — porta 1:1 il vecchio renderApp()
ui/modal.js              toast/confirmModal/formModal — invariati
ui/screens/              una schermata per file (landing, login, createTeam, joinTeam, home, rosa,
                          partita/{setup,tracker,boxscore}, storico, statistiche, classifica,
                          calendario, utenti, squadra)
utils/                   format, permessi, tema colori, calcoli statistici (IND/MVP, aggregati stagionali)
styles/app.css           l'intero foglio di stile originale, portato invariato
```

Il motore del match tracker (cronometro, undo stack, calcolo statistiche, Valutazione IND) **non è
cambiato a livello logico** rispetto al file originale: è stato solo spostato in
`ui/screens/partita/tracker.js`, con la persistenza sostituita da chiamate a Supabase invece di
`storageGet`/`storageSet`.

## 4. Design system

```
Colori (personalizzabili da Admin in "Squadra", default arancione/nero):
  --bg:      #0B0D10   sfondo, fisso, non personalizzabile
  --panel:   #151920   pannelli
  --panel2:  #1C222B   pannelli secondari/input
  --line:    #262C36   bordi
  --text:    #F2F0EA   testo principale
  --dim:     #8B93A1   testo secondario
  --orange:  #FF6A13   ACCENTO PRIMARIO — personalizzabile (teams.primary_color)
  --gold:    #FFC53D   ACCENTO SECONDARIO — personalizzabile (teams.secondary_color)
  --green:   #2FB67C   fisso, semantico (azioni positive: canestro, assist...)
  --red:     #E5484D   fisso, semantico (errori, falli, palle perse...)

Font:
  --font-display: Manrope (700/800)   titoli, numeri grandi, hero
  --font-body:     Inter               testo UI, form
  --font-mono:     Roboto Mono         numeri tabellari (box score, cronometro)

Raggi: --radius 12px (componenti piccoli) · --radius-md 20px · --radius-lg 26px (card hero/home)
```

Invariato rispetto alla versione precedente — vedi `app/src/styles/app.css`.

## 5. Modello dati e persistenza (Supabase)

Schema completo in `app/supabase/schema.sql` (da eseguire una volta nel SQL Editor del progetto
Supabase). Mappatura rispetto alle vecchie chiavi di storage:

| Chiave storage (vecchia) | Tabella Supabase | Note |
|---|---|---|
| `team_profile` | `teams` | + `invite_code` (per far entrare nuovo staff), `logo_url` (Supabase Storage, non più dataURL) |
| `team_users` | `profiles` | `id` = `auth.users.id`; password gestite da Supabase Auth, non più hash in chiaro nel DB |
| `team_roster` | `players` | invariata (number, name) |
| `team_game_live` + `team_game_history` | `games` | unica tabella, colonna `status` ('live'\|'finished') |
| `team_next_match` | `next_match` | una riga per team |
| `team_standings` | `standings` | invariata |

`games.players` resta un blob `jsonb` con la stessa forma di `liveGame.players` di prima (array di
`{id, number, name, onCourt, stats}`) — nessuna normalizzazione in tabelle separate, per mantenere
il motore del match tracker quasi invariato.

**Multi-tenant ready**: ogni tabella ha `team_id`. Un progetto Supabase può ospitare più squadre
(utile se in futuro Lorenzo vorrà aprire l'app ad altre squadre) — oggi l'esperienza resta comunque
quella di una singola squadra per chi usa l'app.

**RLS**: abilitata su tutte le tabelle, tramite le funzioni helper `current_team_id()` /
`current_role()`. I permessi per tabella rispecchiano esattamente la matrice ruoli della sezione 6.

**Autenticazione**: Supabase Auth con email+password (non più username custom) — risolve il limite
di sicurezza precedente (nessun recupero password): ora c'è un vero flusso di reset via email
(`requestPasswordReset` in `app/src/auth.js`).

**Ingresso nuovo staff**: non essendo disponibile la `service_role` key lato client (non va mai
esposta nel browser), l'admin non crea più direttamente gli account degli altri utenti. Il flusso è:
1. L'admin condivide il **codice invito** della squadra (visibile/rigenerabile in tab Squadra).
2. Il nuovo membro dello staff si registra da solo ("Entra in una squadra esistente"), entra con
   ruolo di default `segnapunti`.
3. L'admin promuove il ruolo corretto da tab Utenti.

"Rimuovi utente" in Utenti è ora un **soft-delete** (`profiles.active = false`) per lo stesso motivo
(niente `service_role` per cancellare account Auth lato client) — comportamento equivalente per
l'utente finale.

**Se Supabase richiede la conferma email** (impostazione di default per nuovi progetti): dopo la
registrazione non c'è ancora una sessione attiva, quindi la creazione della squadra/il join non può
avvenire subito. L'azione viene salvata in `localStorage` (`bbapp_pending_team_action`) e completata
automaticamente al primo login dopo il click sul link di conferma (vedi `app/src/router.js`).

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
| Squadra (profilo/colori/codice invito) | ✅ solo Admin | ❌ | ❌ |

Filtraggio tab implementato in `TABS` (`app/src/utils/permissions.js`) + `canSeeTab()`, applicato
anche lato server tramite le policy RLS (non solo lato UI).

## 7. Funzionalità già implementate (dettaglio)

Invariate rispetto alla versione precedente (vedi codice in `app/src/ui/screens/`):
wizard creazione squadra, match tracker completo (5 slot in campo, cambi, tiri 2/3/liberi, rimbalzi
off/dif, assist, palle rubate, palle perse con sottotipo, stoppate fatte/subite, falli commessi/
subiti, cronometro con minuti auto-accumulati, +/-, undo), box score live e storico con export CSV/
stampa, Home con hero+card prossima partita+MVP ultima partita (Valutazione IND)+mini-card, tabella
statistiche stagionali, classifica manuale, personalizzazione colori squadra.

## 8. Fase 3 — Specifica per il calendario da PDF (da implementare)

Invariata rispetto alla versione precedente — vedi PDF.js lato client, parsing euristico, schermata
di revisione obbligatoria prima di scrivere su una nuova tabella `calendar`. Nessuna modifica di
piano necessaria per l'architettura Supabase: sarebbe un'altra tabella con `team_id`, stesse policy
RLS del resto.

## 9. Come riprendere lo sviluppo / setup locale

1. Crea un progetto su [supabase.com](https://supabase.com) (piano free).
2. Esegui `app/supabase/schema.sql` nel SQL Editor del progetto (una volta sola).
3. Copia `app/.env.example` in `app/.env.local` e compila `VITE_SUPABASE_URL` e
   `VITE_SUPABASE_ANON_KEY` (Project Settings → API nella dashboard Supabase).
4. `cd app && npm install && npm run dev`.

⚠️ **Nota Node.js**: questa macchina ha Node v14.21.3, troppo vecchio per Vite 5+. Il progetto è
stato configurato con **Vite 2.9.x** per compatibilità. Per continuare a ricevere aggiornamenti di
sicurezza e usare strumenti più recenti, consigliato aggiornare Node a una versione LTS attuale
(20.x) quando possibile — a quel punto si può anche risalire a Vite 5+ senza altre modifiche al
codice applicativo.

## 10. File inclusi in questo handoff

- `files/index.html`, `files/PROJECT_HANDOFF.md` — versione originale a file singolo, mantenuta come
  riferimento storico pre-refactor.
- `app/` — progetto attuale (Vite + Supabase), vedi struttura sezione 3.

## 11. Contesto utente (per continuità di tono/decisioni)

Il progetto è di Lorenzo (@thewhitedrew su GitHub), sviluppato come attività personale/portfolio (ha
un profilo ibrido sales/data analytics, background in progetti self-contained HTML con
localStorage). Preferisce soluzioni dirette, non sovradimensionate, con compromessi spiegati
onestamente invece che nascosti. Comunica in italiano.
