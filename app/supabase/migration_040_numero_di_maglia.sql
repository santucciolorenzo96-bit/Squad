-- ============================================================================
-- SQUAD — migrazione 040
-- Il numero di maglia lo sceglie chi lo indossa, se non ce l'ha ancora
-- ============================================================================
--
-- Undici atleti su tredici della DR2 non hanno un numero: e' il valore
-- predefinito di quando si crea un giocatore, e nessuno e' mai tornato a
-- riempirlo. Nello scout e nel tabellino quei ragazzi si distinguono solo dal
-- nome, e la canotta col numero resta vuota.
--
-- PERCHE' SERVE UNA FUNZIONE NUOVA
--
-- update_linked_player_details() esclude apposta nome e numero: le policy di
-- Postgres sono per riga, non per colonna, quindi senza una funzione dedicata
-- un genitore che puo' scrivere la data di nascita potrebbe scriversi anche il
-- numero di maglia — e cambiarselo a meta' stagione, dopo che quel numero e'
-- gia' in dieci tabellini.
--
-- Questa e' una porta stretta apposta:
--   - la apre solo chi e' collegato a QUELL'atleta;
--   - scrive SOLO il numero;
--   - funziona SOLO se il numero non c'e' ancora. Sceglierlo una volta e'
--     un diritto; cambiarlo a stagione in corso e' una decisione della
--     societa', che dalla scheda puo' farlo sempre.
--   - rifiuta un numero gia' addosso a un compagno della stessa rosa.
--
-- Se un domani vuoi che la famiglia possa anche CAMBIARLO, si toglie il
-- controllo «lo ha gia'» e resta tutto il resto.

create or replace function choose_my_number(p_player_id uuid, p_number text)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_num text;
  v_attuale text;
begin
  v_num := trim(coalesce(p_number, ''));

  if v_num !~ '^[0-9]{1,3}$' then
    raise exception 'Il numero di maglia si scrive in cifre.';
  end if;

  -- «07» e «7» sono lo stesso numero e non devono poter convivere in una rosa.
  -- Lo zero fa eccezione: nel basket «0» e «00» sono due numeri diversi, e
  -- vanno tenuti come sono stati scritti.
  if v_num ~ '^0+$' then
    v_num := left(v_num, 2);
  else
    v_num := ltrim(v_num, '0');
  end if;

  -- Collegato a questo atleta? Non «a un atleta»: a questo.
  if not exists (
    select 1 from profile_players pp
     where pp.profile_id = auth.uid() and pp.player_id = p_player_id
  ) then
    raise exception 'Questa scheda non è la tua.';
  end if;

  select nullif(trim(coalesce(number, '')), '-') into v_attuale
    from players where id = p_player_id;

  if coalesce(v_attuale, '') <> '' then
    raise exception 'Il numero c''è già: per cambiarlo serve la società.';
  end if;

  -- Libero fra i compagni: stessa categoria e stessa stagione.
  if exists (
    select 1
      from player_sectors mio
      join player_sectors suo
        on suo.sector_id = mio.sector_id
       and coalesce(suo.season_id::text, '') = coalesce(mio.season_id::text, '')
      join players altro on altro.id = suo.player_id
     where mio.player_id = p_player_id
       and altro.id <> p_player_id
       and trim(coalesce(altro.number, '')) = v_num
  ) then
    raise exception 'Il numero % ce l''ha già un compagno di squadra.', v_num;
  end if;

  update players set number = v_num where id = p_player_id;
  return v_num;
end;
$$;

grant execute on function choose_my_number(uuid, text) to authenticated;
