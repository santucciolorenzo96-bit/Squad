# Mappa dei dati personali

Ricavata dallo schema, non a memoria. Serve a due cose: costruire il registro
dei trattamenti che la società deve tenere, e sapere cosa rispondere quando
qualcuno chiede «che dati avete su mio figlio».

**Questo file non è un'informativa privacy e non rende conforme nessuno.**
È la base tecnica su cui un legale scrive l'informativa.

---

## Cosa rende questo progetto delicato

Due cose, e vanno dette per prime:

1. **Gli interessati sono in larga parte minorenni.** Il consenso lo presta
   l'esercente la responsabilità genitoriale, e va raccolto in modo
   dimostrabile.
2. **Si tratta un dato relativo alla salute.** La data di scadenza del
   certificato medico agonistico dice che quella persona è stata dichiarata
   idonea all'attività sportiva fino a una certa data. È un dato dell'art. 9,
   e richiede una base giuridica propria — non basta il consenso generico
   all'iscrizione.

---

## Dove stanno i dati

| Tabella | Dati personali | Categoria |
|---|---|---|
| `players` | nome, data di nascita, codice fiscale, email, telefono del tutore, altezza, fotografia | comuni, **di minori** |
| `player_documents` | certificato agonistico e tesseramento: file, stato, **data di scadenza** | **art. 9 — salute** |
| `profiles` | nome, telefono, ruolo | comuni |
| `auth.users` (Supabase) | email, password cifrata, accessi | comuni |
| `finance_entries` | quote dovute da un atleta, importi, scadenze | comuni |
| `finance_payments` | versamenti effettuati | comuni |
| `training_attendance` | presenza o assenza a ogni allenamento | comuni |
| `communication_recipients` | risposta a ogni convocazione | comuni |
| `player_development` | obiettivo tecnico e nota dell'allenatore | comuni |
| Storage `player-photos` | fotografie degli atleti | comuni, **di minori** |
| Storage `player-documents` | scansioni dei certificati | **art. 9 — salute** |

`player_development` è volutamente limitata al piano tecnico-sportivo: non
contiene infortuni, diagnosi né valutazioni mediche. È una scelta di progetto
e va mantenuta — spostarla renderebbe l'intera scheda un trattamento sanitario.

---

## Finalità, così come emergono dall'uso

| Finalità | Base giuridica plausibile | Da verificare con un legale |
|---|---|---|
| Tesseramento e partecipazione all'attività | esecuzione del contratto associativo | — |
| Verifica dell'idoneità agonistica | obbligo di legge (D.M. 18/02/1982) | qualifica come art. 9(2)(b) o (h) |
| Gestione amministrativa delle quote | esecuzione del contratto, obblighi fiscali | conservazione decennale |
| Convocazioni e comunicazioni | esecuzione del contratto | — |
| Statistiche e valutazioni tecniche | legittimo interesse | serve una valutazione di bilanciamento |
| Fotografie degli atleti | consenso, revocabile | consenso separato dagli altri |

L'ultima riga è quella che si dimentica più spesso: la fotografia richiede un
consenso **distinto** e revocabile, non compreso in quello all'iscrizione.

---

## Conservazione: da decidere

Nessuna di queste durate è oggi impostata nell'app. Sono decisioni della
società, non del software.

| Dato | Durata ragionevole | Perché |
|---|---|---|
| Anagrafica di un atleta che ha smesso | 1 anno dalla fine dell'ultima stagione | oltre non serve a niente |
| Certificati medici | fino a scadenza + 1 anno | dato sanitario: la durata più breve possibile |
| Movimenti contabili | 10 anni | obbligo civilistico e fiscale |
| Presenze e statistiche | fine stagione + 2 anni | interesse storico della società |
| Fotografie | fino a revoca del consenso | — |

---

## Cosa c'è già nell'app

- **Consenso registrato** — data e versione dell'informativa su `profiles`,
  scritti solo dall'interessato tramite `accept_privacy()`
- **Cancellazione** — `erase_player()` anonimizza l'atleta ovunque compaia ed
  elimina i documenti sanitari, lasciando in piedi i soli movimenti contabili
  che la legge impone di conservare
- **Accesso** — `player_personal_data()` restituisce in un colpo solo tutto
  ciò che l'app conserva su una persona
- **Portabilità** — export CSV di rosa, statistiche, partite e presenze
- **Minimizzazione** — le policy `row level security` limitano la visibilità
  alla categoria di competenza: un allenatore dell'Under 15 non vede i dati
  dell'Under 17
- **Cifratura** — in transito (HTTPS) e a riposo (Postgres gestito)

## Cosa manca, e non è codice

- [ ] Informativa privacy scritta e pubblicata
- [ ] Raccolta del consenso genitoriale, con le finalità separate
- [ ] Consenso distinto per le fotografie
- [ ] Nomina di Supabase come responsabile del trattamento (DPA da firmare)
- [ ] **Verifica della regione del progetto Supabase**: se i dati sono fuori
      dall'Unione servono le garanzie per il trasferimento
- [ ] Registro dei trattamenti
- [ ] Politica di conservazione adottata formalmente
- [ ] Procedura per rispondere alle richieste degli interessati entro 30 giorni
- [ ] Valutazione se serva un DPIA — dati di minori e dati sanitari insieme
      la rendono probabile
