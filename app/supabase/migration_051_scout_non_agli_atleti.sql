-- ============================================================================
-- SQUAD — migrazione 051
-- Lo scout non è degli atleti, nemmeno con il permesso
-- ============================================================================
--
-- `can_score_matches` è il permesso che un amministratore dà a chi tiene il
-- tabellino pur non essendo staff. Nella pratica è il genitore segnapunti, che
-- in ogni palestra esiste ed è una figura vera.
--
-- Su un atleta no: sta giocando. Il tabellino della propria squadra non è una
-- cosa che si tiene dal campo, e vedersi comparire lo Scout fra le sezioni è
-- un invito a toccarlo.
--
-- L'applicazione lo dice in `canSeeTab` (utils/permissions.js) togliendo la
-- voce dal menu. Questa è l'altra metà: senza, la voce sparirebbe ma
-- l'indirizzo continuerebbe a funzionare, e il database accetterebbe le
-- scritture. È lo stesso scollamento che ci è costato la caccia alla
-- fotografia — la regola vera sta qui.

create or replace function family_can_score_matches()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select p.can_score_matches and p.role <> 'atleta'
      from profiles p where p.id = auth.uid()
  ), false)
$$;
