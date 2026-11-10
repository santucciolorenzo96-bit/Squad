/* CARICARE UN DOCUMENTO: COSA SI CONTROLLA PRIMA, E COSA SI DICE SE VA MALE.
 *
 * Una famiglia carica il certificato medico dal telefono, con una fotografia.
 * Tutto quello che può andare storto in quel momento — file troppo grande,
 * formato che il browser non sa aprire, rete che cade a metà — arrivava a
 * chi stava caricando come «Operazione non riuscita» o, peggio, come il
 * messaggio grezzo del database. Chi legge «new row violates row-level
 * security policy» non sa cosa fare; chi legge «il file pesa 14 MB, il
 * limite è 10» sì — e lo riscatta più piccolo.
 */

export const MAX_DOCUMENTO_MB = 10;

const TIPI_CONSENTITI = /^(image\/(jpeg|jpg|png|webp|heic|heif|gif)|application\/pdf)$/i;
const ESTENSIONI_CONSENTITE = /\.(jpe?g|png|webp|heic|heif|gif|pdf)$/i;

/* Un problema, o null se il file va bene. Si controlla PRIMA di toccare la
 * rete: scoprire che il file è vuoto dopo averlo caricato per metà è
 * inutile. */
export function controllaFile(file, maxMb = MAX_DOCUMENTO_MB) {
  if (!file) return 'Scegli un file.';
  if (!file.size) {
    return 'Il file è vuoto. Succede quando la fotografia non è ancora scaricata dal telefono: riprova fra un attimo.';
  }
  if (file.size > maxMb * 1024 * 1024) {
    const mb = (file.size / (1024 * 1024)).toFixed(1).replace('.', ',');
    return `Il file pesa ${mb} MB e il limite è ${maxMb} MB. Se è una fotografia, scattala di nuovo o riducine la qualità; se è un PDF, esportalo più leggero.`;
  }
  // Alcuni telefoni non dichiarano il tipo: allora si guarda l'estensione.
  const tipoOk = file.type ? TIPI_CONSENTITI.test(file.type) : ESTENSIONI_CONSENTITE.test(file.name || '');
  if (!tipoOk) return 'Va bene una fotografia o un PDF: questo tipo di file non si può caricare.';
  return null;
}

export function eFotografia(file) {
  return !!file && !!file.type && /^image\//i.test(file.type);
}

/* L'estensione dice COSA C'È DENTRO, non come si chiamava il file.
 *
 * Una fotografia ridotta diventa JPEG, ma la sua estensione era quella
 * dell'originale: `.heic` dall'iPhone, `.png` da uno screenshot. Un file
 * chiamato `.heic` che contiene un JPEG non lo apre nessuno che si fidi
 * del nome. */
export function estensioneDa(blob, nomeOriginale) {
  const tipo = blob && blob.type ? blob.type.toLowerCase() : '';
  if (tipo === 'application/pdf') return 'pdf';
  if (tipo === 'image/jpeg' || tipo === 'image/jpg') return 'jpg';
  if (tipo === 'image/png') return 'png';
  if (tipo === 'image/webp') return 'webp';
  const dalNome = String(nomeOriginale || '').split('.').pop().toLowerCase();
  return /^[a-z0-9]{2,5}$/.test(dalNome) ? dalNome : 'jpg';
}

/* L'errore, in parole di chi sta caricando. Ordine: prima ciò che si può
 * riconoscere con certezza, poi il resto con le parole del database. */
export function descriviErroreCaricamento(errore) {
  const msg = String((errore && (errore.message || errore.error_description || errore.error)) || errore || '');
  const stato = errore && (errore.statusCode || errore.status);

  if (/failed to fetch|networkerror|network request failed|load failed|timeout|timed out/i.test(msg)) {
    return 'La connessione è caduta prima che il file arrivasse. Non è stato caricato niente: controlla la rete e riprova.';
  }
  if (/row-level security|violates|not authorized|unauthorized|permission denied/i.test(msg) || String(stato) === '403') {
    return 'Non hai il permesso di caricare documenti per questo atleta. Se pensi di averlo, chiedi alla società di controllare che il tuo account sia collegato alla sua scheda.';
  }
  if (/payload too large|exceeded the maximum|too large/i.test(msg) || String(stato) === '413') {
    return 'Il file è troppo grande per essere accettato. Riducilo e riprova.';
  }
  if (/already exists|duplicate/i.test(msg)) {
    return 'Questo file risulta già caricato. Ricarica la pagina per vederlo nell’elenco.';
  }
  if (/mime|invalid.*type|unsupported/i.test(msg)) {
    return 'Il tipo di file non è accettato. Va bene una fotografia o un PDF.';
  }
  return msg ? 'Non è stato possibile caricare il documento: ' + msg : 'Non è stato possibile caricare il documento. Riprova.';
}

/* Perché una fotografia non si è potuta ridurre. `loadImage` rifiuta con un
 * Event, non con un Error: senza questo, chi caricava leggeva «Operazione non
 * riuscita» e basta. */
export const FOTO_NON_LEGGIBILE =
  'Non riesco ad aprire questa fotografia: il formato potrebbe non essere supportato da questo dispositivo (succede con le foto HEIC aperte da un computer). Scattala di nuovo, oppure esportala in JPEG o PDF.';
