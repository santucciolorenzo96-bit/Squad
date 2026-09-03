import { state } from '../state.js';
import { toast } from './modal.js';
import { acceptPrivacy, PRIVACY_VERSION } from '../api/privacy.js';

// Informativa e raccolta del consenso.
//
// Il testo qui sotto è una BOZZA TECNICA: descrive fedelmente cosa l'app fa
// coi dati, ricavato dallo schema, e serve a un legale come punto di partenza.
// Non sostituisce un'informativa redatta da chi ne ha titolo, e i due campi
// fra parentesi quadre vanno compilati dalla società prima di qualunque uso
// reale.
//
// La versione accettata viene registrata insieme alla data: cambiando
// PRIVACY_VERSION il consenso viene richiesto di nuovo a tutti, che è l'unico
// modo perché resti dimostrabile dopo un aggiornamento del testo.

export const PRIVACY_TEXT = `
<h3>Chi tratta i dati</h3>
<p>Il titolare del trattamento è la società sportiva che gestisce questo spazio.
I riferimenti per contattarla — sede e indirizzo email — sono indicati nella
sezione Squadra dell'applicazione.</p>

<h3>Quali dati raccogliamo</h3>
<p><b>Dell'atleta:</b> nome, data di nascita, codice fiscale, altezza,
fotografia, recapito email e telefono di un genitore o tutore.</p>
<p><b>Sull'attività:</b> presenza agli allenamenti, convocazioni e relative
risposte, statistiche delle partite giocate, obiettivi tecnici e note
dell'allenatore.</p>
<p><b>Documenti:</b> certificato medico agonistico con la sua data di scadenza
e tesseramento federale. Il certificato è un dato relativo alla salute e
riceve una tutela rafforzata.</p>
<p><b>Amministrazione:</b> quote dovute e versate.</p>

<h3>Perché li trattiamo</h3>
<ul>
<li>Per tesserarti e farti partecipare all'attività sportiva — è l'esecuzione
del rapporto associativo.</li>
<li>Per verificare l'idoneità agonistica, che la legge impone alla società di
accertare prima dell'attività.</li>
<li>Per la gestione amministrativa delle quote e per gli obblighi fiscali che
ne derivano.</li>
<li>Per convocare e comunicare con gli atleti e le loro famiglie.</li>
<li>Per elaborare statistiche e valutazioni tecniche a uso interno dello staff.</li>
</ul>

<h3>La fotografia</h3>
<p>Il caricamento della fotografia è facoltativo e il relativo consenso è
distinto: puoi revocarlo in qualunque momento chiedendone la rimozione, senza
che questo incida su nient'altro.</p>

<h3>Chi li vede</h3>
<p>Solo le persone della società con un ruolo che lo richiede, e solo per le
categorie a cui sono assegnate: un allenatore dell'Under 15 non vede i dati
dell'Under 17. Un genitore vede i dati del proprio figlio e nessun altro.</p>
<p>I dati sono conservati su Supabase, che agisce come responsabile del
trattamento. Non vengono ceduti a terzi né usati per finalità commerciali.</p>

<h3>Per quanto tempo</h3>
<p>I dati anagrafici restano per la durata del rapporto e per [•] dopo la sua
cessazione. I certificati medici sono eliminati entro un anno dalla scadenza.
I movimenti contabili sono conservati dieci anni, come impone la legge.</p>

<h3>I tuoi diritti</h3>
<p>Puoi chiedere in qualsiasi momento di sapere quali dati conserviamo, di
correggerli, di riceverne una copia, di limitarne il trattamento o di
cancellarli. L'applicazione può produrre l'elenco completo dei dati conservati
su una persona e può cancellarli, mantenendo i soli movimenti contabili che la
legge obbliga a conservare — privati però del nome.</p>
<p>Per esercitare questi diritti scrivi a [•]. Hai inoltre diritto di
reclamo al Garante per la protezione dei dati personali.</p>

<h3>Se l'atleta è minorenne</h3>
<p>Il consenso è prestato da chi esercita la responsabilità genitoriale, che
può revocarlo in qualunque momento con le stesse modalità.</p>
`;

export function openPrivacyText() {
  const root = document.getElementById('modalRoot');
  root.innerHTML = `
    <div class="modal-overlay" id="privOverlay"><div class="modal-box wide">
      <h3>Informativa sul trattamento dei dati</h3>
      <div class="privacy-body">${PRIVACY_TEXT}</div>
      <div class="modal-actions"><button class="btn btn-secondary" id="privClose" style="width:100%;">Chiudi</button></div>
    </div></div>`;
  document.getElementById('privClose').onclick = () => { root.innerHTML = ''; };
  document.getElementById('privOverlay').onclick = (e) => { if (e.target.id === 'privOverlay') root.innerHTML = ''; };
}

// Gli account creati prima che il consenso esistesse non hanno una data: va
// chiesto una volta, all'apertura, invece di lasciarli in un limbo in cui il
// consenso non risulta da nessuna parte.
export function needsPrivacyConsent(user) {
  if (!user) return false;
  return !user.privacy_accepted_at || user.privacy_version !== PRIVACY_VERSION;
}

export function openPrivacyConsent(onDone) {
  const root = document.getElementById('modalRoot');
  root.innerHTML = `
    <div class="modal-overlay" id="pcOverlay"><div class="modal-box wide">
      <h3>Prima di continuare</h3>
      <p style="font-size:13.5px;color:var(--dim);line-height:1.55;">
        Abbiamo scritto come vengono trattati i dati tuoi e di tuo figlio.
        Leggila e confermala: serve una volta sola.
      </p>
      <div class="privacy-body" style="max-height:44vh;overflow-y:auto;">${PRIVACY_TEXT}</div>
      <div class="error-msg" id="pcError"></div>
      <div class="modal-actions" style="flex-direction:column;gap:8px;">
        <button class="btn btn-primary" id="pcAccept" style="width:100%;">Ho letto e accetto</button>
      </div>
    </div></div>`;

  document.getElementById('pcAccept').onclick = async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true; btn.textContent = 'Registro…';
    try {
      await acceptPrivacy();
      state.currentUser.privacy_accepted_at = new Date().toISOString();
      state.currentUser.privacy_version = PRIVACY_VERSION;
      root.innerHTML = '';
      if (onDone) onDone();
    } catch (err) {
      btn.disabled = false; btn.textContent = 'Ho letto e accetto';
      document.getElementById('pcError').textContent =
        (err && err.message) || 'Non è stato possibile registrare il consenso.';
    }
  };
}
