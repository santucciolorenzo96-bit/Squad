-- ============================================================================
-- SQUAD — dove si è fermato lo scout
-- ============================================================================
--
-- Uno scout è sparito dallo schermo dopo cinque minuti di amichevole. Da oggi
-- un'eccezione non fa più scomparire la schermata (c'è una rete di sicurezza
-- che mostra e conserva il messaggio), ma di QUELLA partita il messaggio non
-- esiste: se ne può però ricostruire il momento.
--
-- Il registro delle azioni porta con sé l'ordine di tutto quello che è stato
-- segnato. L'ultima azione scritta è quella prima dello schianto, e l'ora
-- dell'ultimo salvataggio dice quando è stato.
--
-- Da lanciare nell'SQL editor di Supabase. Non modifica niente.

-- ----------------------------------------------------------------- PASSO 1
-- Le partite toccate nelle ultime 48 ore: quante azioni hanno, quando è
-- arrivato l'ultimo salvataggio, e da quale dispositivo.
--
-- Una partita ancora `live` con l'ultimo salvataggio a metà partita è quella:
-- lo scout è morto e non ha più scritto niente.

select
  g.id,
  g.status,
  g.opp_name                              as avversario,
  s.name                                  as categoria,
  g.started_at,
  g.tenuto_alle                           as ultimo_salvataggio,
  round(extract(epoch from (g.tenuto_alle - g.started_at)) / 60)  as minuti_segnati,
  g.revisione                             as salvataggi,
  jsonb_array_length(coalesce(g.storia, '[]'::jsonb))             as azioni,
  g.quarter                               as periodo_in_corso,
  g.chiusi                                as periodi_chiusi,
  g.team_score || '-' || g.opp_score      as punteggio,
  jsonb_array_length(coalesce(g.players, '[]'::jsonb))            as giocatori,
  -- Le tre cose che, mancando, fanno morire lo scout in una ventina di punti
  -- diversi. Se una di queste non è un elenco, è lei.
  jsonb_typeof(g.players)                 as tipo_players,
  jsonb_typeof(g.storia)                  as tipo_storia,
  jsonb_typeof(g.period_scores)           as tipo_periodi
from games g
left join sectors s on s.id = g.sector_id
where g.started_at > now() - interval '48 hours'
   or g.tenuto_alle > now() - interval '48 hours'
order by coalesce(g.tenuto_alle, g.started_at) desc;


-- ----------------------------------------------------------------- PASSO 2
-- Le ultime dodici azioni della partita più recente: l'ultima è quella su cui
-- si è fermato tutto.
--
-- `a` è il nome dell'azione, `p` chi l'ha fatta, `q` il periodo. Un `loro`
-- sono punti avversari, un `noi` una correzione a mano del nostro punteggio.

with ultima as (
  select g.id, g.storia
  from games g
  where g.started_at > now() - interval '48 hours'
  order by coalesce(g.tenuto_alle, g.started_at) desc
  limit 1
)
select
  ordine,
  voce->>'q'  as periodo,
  voce->>'a'  as azione,
  voce->>'p'  as giocatore,
  voce->>'n'  as punti
from ultima,
     jsonb_array_elements(coalesce(ultima.storia, '[]'::jsonb))
       with ordinality as t(voce, ordine)
order by ordine desc
limit 12;


-- ----------------------------------------------------------------- PASSO 3
-- I giocatori di quella partita, uno per riga, con quello che potrebbe
-- mancargli.
--
-- Un giocatore SENZA `stats` faceva lanciare `esegui` al primo tocco sul suo
-- gettone: la lettura era prudente, la scrittura no. Adesso le statistiche si
-- creano se non c'è, ma se qui ne compare uno senza, quello era il tocco.

with ultima as (
  select g.id, g.players
  from games g
  where g.started_at > now() - interval '48 hours'
  order by coalesce(g.tenuto_alle, g.started_at) desc
  limit 1
)
select
  p->>'number'                    as maglia,
  p->>'name'                      as nome,
  (p->>'onCourt')::boolean        as in_campo,
  jsonb_typeof(p->'stats')        as tipo_stats,
  case when p->'stats' is null or jsonb_typeof(p->'stats') <> 'object'
       then 'SENZA STATISTICHE' end                                as attenzione,
  jsonb_array_length(coalesce(p->'stats'->'tiri', '[]'::jsonb))     as tiri_segnati,
  jsonb_array_length(coalesce(p->'stats'->'traiettorie', '[]'::jsonb)) as traiettorie
from ultima, jsonb_array_elements(coalesce(ultima.players, '[]'::jsonb)) as p
order by (p->>'onCourt')::boolean desc nulls last, nome;


-- ----------------------------------------------------------------- PASSO 4
-- Due dispositivi sulla stessa partita?
--
-- Se lo scout era stato dato a qualcun altro E la partita è stata aperta anche
-- altrove, il secondo dispositivo si prende il tabellino e al primo compare
-- «la sta segnando qualcun altro». Non è un crash, ma da fuori si assomiglia:
-- lo scout smette di funzionare.

select
  g.opp_name                        as avversario,
  g.tenuto_da                       as ultimo_dispositivo,
  p.display_name                    as di_chi,
  g.tenuto_alle                     as quando,
  g.revisione                       as salvataggi
from games g
left join profiles p on p.id = g.tenuto_da
where g.started_at > now() - interval '48 hours'
order by g.tenuto_alle desc;
