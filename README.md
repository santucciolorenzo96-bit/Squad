# Squad

Gestionale per società sportive: rosa, allenamenti, partite, statistiche,
documenti e finanza. Vite + Supabase.

## Le due pagine

- `app/index.html` — l'app. Interfaccia in React (`app/src/next/`).
- `app/classica.html` — la versione precedente, stesso database e stessa
  sessione. Resta come via di ritorno finché serve.

## In locale

```
cd app
npm install
cp .env.example .env.local     # VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
npm run dev
```

`npm test` esegue la suite (nessuna dipendenza esterna), `npm run build`
produce `app/dist`.

## Pubblicazione su Vercel

Il `vercel.json` in radice dice tutto quello che serve: installa e costruisce
dentro `app/`, pubblica `app/dist`. Il progetto Vercel deve avere le due
variabili d'ambiente `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`: la build
le incorpora nel bundle, quindi senza di esse l'app si apre ma non parla con
nessun database.

Le migrazioni SQL stanno in `app/supabase/` e si eseguono a mano, in ordine di
numero, dall'editor SQL di Supabase.
