/* IL NOME DI UNA SQUADRA, COME SI LEGGE.
 *
 * La federazione scrive i nomi in stampatello: «ASD BP BASKET POINT ACI
 * SANT'A», «CESTISTICA ETNEA BASKET». Il calendario caricato dal PDF li porta
 * così in classifica, nei risultati, in Home. Sono righe che gridano, e vicino
 * al nome della nostra società — scritto in minuscolo — sembrano di un altro
 * programma.
 *
 * QUESTA È SOLO PRESENTAZIONE. Il nome nei dati resta quello della
 * federazione, perché è con quello che si confrontano le righe (`siamoNoi`,
 * `nostraPartita`, i loghi, la classifica): cambiarlo alla fonte vorrebbe dire
 * rompere ogni confronto. Si formatta quando si disegna, e basta.
 *
 * SI TOCCANO SOLO I NOMI INTERAMENTE MAIUSCOLI. Un nome scritto da una persona
 * in maiuscole e minuscole — «Cestistica Etnea», «Virtus Ragusa» — l'ha scritto
 * così per una ragione, e non lo si ritocca.
 *
 * LE SIGLE RESTANO SIGLE. «ASD» non diventa «Asd» e «BP» non diventa «Bp»:
 * sono parole che si leggono lettera per lettera, e in minuscolo perdono il
 * senso. Si riconoscono dall'elenco delle forme societarie e sportive più
 * comuni, e da una regola: una parola di al più quattro lettere senza vocali è
 * una sigla. Quelle che sfuggono a tutte e due si scrivono comunque in modo
 * leggibile — «Bp» è meglio di «BP» in una riga di nomi normali? No, ma è meglio
 * di un nome ridotto a una parola mutilata — e la regola sta qui, in un posto
 * solo, per correggerla quando capita.
 */

const SIGLE = new Set([
  'ASD', 'SSD', 'SSDARL', 'SSDRL', 'SRL', 'SPA', 'ASDC', 'APD', 'PGS', 'GS',
  'US', 'USD', 'CUS', 'CSI', 'FC', 'BC', 'BK', 'SC', 'AC', 'AS', 'VBC', 'CB',
  'ASDP', 'ASSD', 'APS', 'ETS'
]);

// Le parole che nel nome di una società si scrivono minuscole, tranne in testa.
const CONNETTIVI = new Set(['di', 'del', 'della', 'dei', 'delle', 'degli', 'dello', 'de', 'da', 'e', 'ed', 'la', 'il', 'lo', 'le', 'i']);

const ROMANO = /^[IVX]+$/;
const CON_PUNTI = /^([A-Z]\.)+$/;
const VOCALI = /[AEIOUÀÈÉÌÒÙ]/;

export function eTuttoMaiuscolo(nome) {
  const s = String(nome || '');
  return /[A-ZÀ-Ý]/.test(s) && s === s.toUpperCase() && s !== s.toLowerCase();
}

function maiuscolaIniziale(parola) {
  // Dopo un apostrofo si ricomincia: «SANT'ANTONIO» → «Sant'Antonio».
  return parola
    .toLowerCase()
    .replace(/(^|['’\-/])(\p{L})/gu, (m, sep, lettera) => sep + lettera.toUpperCase());
}

function sigla(parola) {
  if (SIGLE.has(parola)) return true;
  if (ROMANO.test(parola)) return true;
  if (CON_PUNTI.test(parola)) return true;
  return parola.length <= 4 && /^\p{L}+$/u.test(parola) && !VOCALI.test(parola);
}

/**
 * Il nome da mostrare. Un nome già in maiuscole e minuscole passa com'è.
 */
export function nomeSquadra(nome) {
  const s = String(nome == null ? '' : nome).trim();
  if (!s || !eTuttoMaiuscolo(s)) return s;
  return s
    .split(/\s+/)
    .map((parola, i) => {
      if (sigla(parola)) return parola;
      const minuscola = parola.toLowerCase();
      if (i > 0 && CONNETTIVI.has(minuscola)) return minuscola;
      return maiuscolaIniziale(parola);
    })
    .join(' ');
}
