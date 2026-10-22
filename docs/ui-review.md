# Review grafica e UX di Arkimind (ottobre 2026)

Review dell'interfaccia React (`src/mainview/`) prima del redesign, fatta
navigando tutte le schermate con dati di prova (`bun run preview:mock`).
Il flusso dell'app è sempre lo stesso: **file in arrivo → analisi AI →
revisione → archiviazione su Drive**. L'interfaccia però non lo racconta.

## 1. Struttura e navigazione

- **"Dashboard" non è una dashboard**: è la coda dei file da archiviare, ma il
  nome non lo dice e non c'è alcun riepilogo (quanti da analizzare, quanti
  pronti, quanti da verificare).
- **Sidebar rumorosa**: in basso versione, tema, comprimi, scorciatoie, stato
  Drive e ultimo aggiornamento hanno tutti lo stesso peso visivo.
- **Login nascosto**: se non sei autenticato il banner giallo ti manda alle
  Impostazioni invece di farti accedere subito. La Dashboard intanto prova a
  caricare i file e mostra errori.
- **Avvio a schermo bianco**: finché `getSettings` non risponde, `App` non
  renderizza nulla.
- **Scorciatoie che non fanno ciò che promettono**: ⌘R aggiorna solo l'orario
  "Ultimo aggiornamento" senza ricaricare i dati; ⌘K cambia tab ma non mette
  il focus sulla ricerca.
- **Stato perso tra i tab**: cambiando tab il componente viene smontato, i
  file vengono ricaricati e un'operazione batch in corso perde la UI.

## 2. Dashboard (coda inbox)

- **Troppi pulsanti di pari peso**: ogni cartella ha Carica, Analizza tutti,
  Archivia tutti, Classifica e archivia. "Analizza" e "Classifica" indicano la
  stessa azione con due nomi diversi.
- **Azioni di riga solo icone**: fino a 5 icone colorate senza etichetta
  (occhio, scintille, matita, archivio, refresh). La stessa icona ✨ indica sia
  "Analizza" sia "Vedi classificazione".
- **L'informazione decisiva è nascosta**: dalla riga non si vede cosa ha
  capito l'AI (categoria, ente, data) né dove finirà il file. Per saperlo
  bisogna aprire un modale.
- **I documenti incerti non risaltano**: confidenza bassa e "Richiede
  validazione umana" compaiono solo in fondo al modale.
- **Catena di modali**: Risultato → Conferma archiviazione → Modifica, tre
  livelli sovrapposti per un solo file. Escape li chiude tutti insieme, perché
  ogni modale ascolta `keydown` su `window`.
- **La modifica non viene salvata**: `ClassificationEditor` aggiorna solo lo
  stato locale. Categoria, ente, data e ricorrenza modificati si perdono al
  ricaricamento. Solo percorso e nome file hanno effetto, e solo
  sull'archiviazione successiva.
- **Errore di caricamento = spinner infinito**: se `listFiles` fallisce, la
  cartella resta in caricamento per sempre e c'è solo un toast.
- **Drag & drop incoerente**: il banner "Rilascia per caricare" compare solo
  nelle cartelle non vuote; `dragleave` sui figli lo fa lampeggiare.
- **Sovrapposizioni**: il pannello upload e i toast stanno entrambi in basso a
  destra.
- **Archiviazione batch senza conferma**: "Archivia tutti" sposta subito N file
  su Drive secondo i suggerimenti dell'AI, anche quelli da verificare.

## 3. Risultato classificazione

- **Gerarchia invertita**: lunga lista "Etichetta: valore", con un'icona per
  riga. La destinazione (la decisione da prendere) sta a metà, l'avviso di
  validazione in fondo.
- **Valori grezzi in inglese**: `high`, `monthly`, `subscription` in una UI
  italiana.
- **Formati non localizzati**: importi "EUR 84.37" invece di "84,37 €"; date
  ISO "2026-09-30".
- **Codice duplicato**: `ClassificationResult` e `DocumentDetailDialog`
  rendono gli stessi dati con due implementazioni che già divergono.

## 4. Documenti

- **Batch pericolosi e ambigui**: tre pulsanti solo icona (↻, cartella, ⚡)
  agiscono su *tutti* i documenti filtrati, senza conferma né conteggio.
- **Filtri nascosti**: i filtri stanno dietro un toggle, con label da 10 px, e
  il numero di risultati si vede solo a pannello aperto.
- **Card poco scansionabili**: 6 icone per riga, metadati sparsi con un'icona
  ciascuno e percorso monospace lungo. Non c'è struttura a colonne per
  confrontare data, categoria e stato.
- **"Riarchivia" incomprensibile**: compare quando il percorso suggerito
  differisce da quello attuale, ma l'interfaccia non spiega perché.
- **Eliminazione**: "Elimina solo dal database locale" è gergo. L'eliminazione
  da Drive è definitiva ma si attiva con un solo click sulla card rossa.
- **Nessun feedback** dopo una ri-analisi riuscita.

## 5. Impostazioni e onboarding

- **Nessuno stato di caricamento**: all'apertura mostra per un attimo "Non
  connesso" e campi vuoti, mentre la sidebar dice "Drive connesso".
- **Un "Salva" per campo**, senza indicazione di modifiche non salvate. Il
  click con il campo vuoto non fa nulla e non dice nulla.
- **Selettori disabilitati senza spiegazione** quando non sei autenticato.
- **Folder browser**: gli errori vengono ingoiati e mostrati come "Nessuna
  sottocartella". Per scegliere una cartella si clicca un piccolo ✓, mentre il
  click sul nome entra nella cartella.
- **Onboarding**: 6 passi con una barra senza etichette; "Salta per ora" come
  link minuscolo; i passi delle cartelle si possono fare senza login e
  falliscono in silenzio.

## 6. Sistema visivo e accessibilità

- **Palette** shadcn neutra (primario nero) più decine di colori Tailwind ad
  hoc (`green-100`, `blue-100`, `yellow-50`, `purple-100`…). Lo stesso stato ha
  colori diversi da una schermata all'altra.
- **Tipografia piatta**: quasi tutto `text-xs`/`text-sm`, poca gerarchia.
  Inter viene scaricato da Google Fonts a ogni avvio: in un'app desktop fallisce
  offline ed è una richiesta di rete superflua.
- **Modali fatti a mano**: niente `role="dialog"`, focus trap né focus
  iniziale. Escape chiude tutti i livelli.
- **Pulsanti icona** con solo `title` (nessun `aria-label`) e significato
  affidato al colore (archivio verde, matita ambra).

## Direzione del redesign

1. Rendere esplicito il flusso: **Da archiviare** (inbox) → **Archivio**
   (documenti) → **Impostazioni**, con conteggi nella sidebar.
2. Una riga = una decisione: mostrare subito cosa ha capito l'AI e dove andrà
   il file, con **un'azione primaria con etichetta** e le altre in un menu.
3. Un unico **pannello laterale di dettaglio**, condiviso tra inbox e
   archivio, al posto della catena di modali. La destinazione è modificabile
   e l'archiviazione parte da lì.
4. Batch come **attività non bloccante** con conferma esplicita e conteggio.
5. Design system coerente: token semantici (successo, attenzione, info,
   pericolo), accento indaco del logo, font di sistema, primitive Radix
   accessibili (Dialog, DropdownMenu, Tooltip).
6. Stati di caricamento, vuoto ed errore progettati per ogni schermata, con
   un'azione per uscirne.

## Cosa è stato fatto

| Prima | Dopo |
| --- | --- |
| Dashboard | **Da archiviare**: riepilogo (da analizzare / pronti / da verificare) che fa anche da filtro; una scheda per cartella con *Carica*, *Analizza N*, *Archivia N* e un menu ⋯; righe con risultato AI, destinazione proposta e un'unica azione primaria con etichetta (*Analizza*, *Archivia*, *Verifica*). |
| Modali Risultato → Conferma → Modifica | **Pannello laterale di dettaglio** (Radix Dialog): avviso «Da verificare» in alto, destinazione modificabile, dati del documento, analisi AI. Si archivia da lì. |
| Documenti | **Archivio**: ricerca sempre visibile (⌘K mette davvero il focus), filtri a vista (stato, categoria, fiscali, ricorrenti), tabella a colonne, menu *Azioni sui risultati* con conteggi e conferma. |
| Batch in modale bloccante | **Pannello attività** in basso a destra, non bloccante, con stato per file, *Interrompi* e righe «In coda». Anche l'upload usa lo stesso pannello. |
| Eliminazione a due card | Scelta esplicita (radio) + pulsante distruttivo che dice cosa farà. |
| Impostazioni con un «Salva» per campo | Sezioni a due colonne; un solo modulo per il servizio di analisi con validazione, stato «Salvato» e chiave mostrabile; tema Chiaro/Scuro/Sistema. |
| Onboarding a barre | Stepper con etichette e spunte, «Più tardi» per i passi facoltativi, riepilogo finale di cosa manca. |
| Palette neutra + colori ad hoc | Token semantici (`success`, `warning`, `info`, `destructive`, ciascuno con `-soft`) e accento indaco del logo, in chiaro e scuro; font di sistema invece di Inter da Google Fonts. |

Correzioni funzionali fatte insieme al redesign:

- ⌘R ricarica davvero i dati della pagina; ⌘K apre l'Archivio con il focus sulla ricerca.
- Una cartella che non si carica mostra l'errore e *Riprova* invece di uno spinner infinito.
- Escape chiude solo il livello in primo piano (Radix).
- Lo stato dell'inbox vive in `App`: cambiare pagina non ricarica i file né interrompe un batch.
- Upload con drag & drop: la conversione base64 andava in `RangeError` sopra qualche centinaio di KB; ora è a blocchi.
- Gli errori noti del backend (servizio non configurato, cartella archivio mancante, Drive non collegato…) diventano messaggi in italiano con l'azione da fare.
- Le anteprime di file Google (Docs, Fogli) usano il PDF esportato invece di dire «non disponibile».

### Correzioni salvate

Prima `ClassificationEditor` modificava solo lo stato React: categoria, ente, date e
ricorrenza andavano persi al ricaricamento. Ora:

- **Modifica** nel pannello (sezioni Destinazione e Documento, o *Correggi* nell'avviso
  «Da verificare») apre un modulo con cartella, nome file, categoria, data, ente, tipo,
  rilevanza fiscale e ricorrenza.
- Il salvataggio passa dalla nuova RPC `updateClassification`, che riscrive
  `classification_json` e le colonne derivate (usate da ricerca e filtri) senza toccare
  stato e posizione d'archivio.
- Il risultato salvato è marcato `user_verified`: sparisce l'avviso «Da verificare» e
  compare «Verificato da te». *Va bene così* conferma senza modificare. Una nuova analisi
  sostituisce la classificazione e toglie il segno.
- Per un documento già archiviato, una nuova cartella salvata compare come «Hai indicato
  una posizione diversa» con il pulsante *Sposta nella nuova posizione*.

Limite noto, non toccato: la ricerca nel DB restituisce al massimo 50 risultati (limite in
`src/bun/db.ts`); l'interfaccia lo segnala.
