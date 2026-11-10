import { supabase } from '../supabaseClient.js';
import { esigiRiga } from './scrittura.js';

/* Gli schemi di gioco (migrazione 065).
 *
 * Una lettura sola per categoria: la lista porta con se' anche `data`, cioe'
 * l'animazione intera. Uno schema pesa qualche KB e l'elenco ne mostra
 * l'anteprima, quindi chiedere i dati a parte vorrebbe dire una richiesta per
 * scheda per disegnare la lista.
 */

const NOTA_MIGRAZIONE =
  'Manca la sezione Schemi: esegui la migrazione 065 su Supabase, poi ricarica la pagina.';

function descrivi(error) {
  const msg = (error && error.message) || '';
  if (/plays|can_edit_plays/.test(msg) && /does not exist|schema cache|Could not find/i.test(msg)) {
    return new Error(NOTA_MIGRAZIONE);
  }
  if (/violates check constraint/.test(msg) && /data/.test(msg)) {
    return new Error('Lo schema è troppo grande per essere salvato: togli qualche passo o una variante.');
  }
  if (/row-level security/.test(msg)) {
    return new Error('Non hai il permesso di modificare gli schemi di questa categoria.');
  }
  return error;
}

export async function fetchPlays(sectorId) {
  if (!sectorId) return [];
  const { data, error } = await supabase.from('plays')
    .select('*')
    .eq('sector_id', sectorId)
    .order('updated_at', { ascending: false });
  if (error) throw descrivi(error);
  return data || [];
}

/* Crea o aggiorna.
 *
 * `notifica` e` esplicito: scrive `notify_at`, e il trigger avvisa gli atleti
 * solo quando quel valore cambia su uno schema pubblicato. Salvare senza
 * avvisare e` il caso normale — un ritocco non merita un avviso. */
export async function savePlay({ id, teamId, sectorId, titolo, etichette, nota, data, pubblicato, notifica }) {
  const riga = {
    title: (titolo || '').trim(),
    labels: etichette || [],
    note: (nota || '').trim() || null,
    data,
    status: pubblicato ? 'published' : 'draft'
  };
  if (notifica && pubblicato) riga.notify_at = new Date().toISOString();

  if (id) {
    const { data: righe, error } = await supabase.from('plays')
      .update(riga).eq('id', id).select();
    if (error) throw descrivi(error);
    // Un update che non tocca nessuna riga non e` un errore per PostgREST:
    // senza questo, salvare uno schema che non si puo` modificare sembrerebbe
    // riuscito.
    return esigiRiga(righe, 'salvare lo schema')[0];
  }

  const { data: nuova, error } = await supabase.from('plays')
    .insert({ team_id: teamId, sector_id: sectorId, ...riga })
    .select();
  if (error) throw descrivi(error);
  return esigiRiga(nuova, 'creare lo schema')[0];
}

export async function deletePlay(id) {
  const { data, error } = await supabase.from('plays').delete().eq('id', id).select('id');
  if (error) throw descrivi(error);
  esigiRiga(data, 'eliminare lo schema');
}
