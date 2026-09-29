-- ============================================================================
-- SQUAD — migrazione 055
-- Quanti periodi sono finiti: un numero che viveva solo in memoria
-- ============================================================================
--
-- Il referto di una partita di pallavolo finita 0-3 mostrava il risultato
-- giusto e solo due set. Il documento si contraddiceva da solo, ed è il
-- genere di errore che toglie fiducia a tutto il resto della pagina.
--
-- COSA SUCCEDEVA
--
-- «Quanti set sono finiti» non si ricava dal numero del set in corso: l'ultimo
-- set di una partita già decisa si chiude senza aprirne un altro, quindi dopo
-- il terzo set di un 3-0 il contatore dice ancora tre, e «tre meno uno» ne
-- perde uno. Per questo lo scout teneva un campo apposta, `chiusi`.
--
-- Solo che `chiusi` non veniva mai salvato: non era né fra le colonne lette né
-- fra quelle scritte. Viveva in memoria per tutta la partita e spariva al
-- primo salvataggio. Il punteggio finale invece era stato calcolato mentre il
-- dato c'era ancora, ed è per questo che era giusto: 0-3 vero, due set
-- disegnati.
--
-- Da qui in poi si salva. E le partite già archiviate si leggono lo stesso:
-- a partita finita, il referto conta i periodi in cui qualcuno ha segnato —
-- si guardano i punti e non l'esistenza della riga, perché una riga può
-- nascere anche solo da una rotazione registrata.

alter table games add column if not exists chiusi int not null default 0;


-- ============================================================================
-- LE PARTITE GIÀ ARCHIVIATE
-- ============================================================================
-- Non è necessario — l'applicazione le legge comunque — ma riempirlo adesso
-- vuol dire non dover ragionare due volte sullo stesso dato. Si contano i
-- periodi con almeno un punto, che è la stessa regola che usa il referto.

update games g
   set chiusi = coalesce((
     select count(*) from jsonb_array_elements(g.period_scores) as p
      where coalesce((p->>'us')::int, 0) + coalesce((p->>'them')::int, 0) > 0
   ), 0)
 where g.status = 'finished'
   and g.chiusi = 0
   and jsonb_typeof(g.period_scores) = 'array';


-- Controllo: per ogni partita finita, quanti periodi risultano chiusi e quale
-- era il risultato. I due numeri devono raccontare la stessa partita — in una
-- pallavolo, i set vinti più quelli persi devono fare i periodi chiusi.
select
  g.started_at::date as quando,
  g.opp_name         as avversario,
  g.team_score       as noi,
  g.opp_score        as loro,
  g.chiusi           as periodi_chiusi
from games g
where g.status = 'finished'
order by g.started_at desc
limit 20;
