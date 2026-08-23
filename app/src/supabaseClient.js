import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.error(
    'Configurazione Supabase mancante. Copia app/.env.example in app/.env.local e ' +
    'compila VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY con i dati del tuo progetto.'
  );
}

export const supabase = createClient(url, anonKey);
