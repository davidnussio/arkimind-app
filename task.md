# Arkimind — Analisi e Task List

## 🔴 Bug e Problemi Critici

### Sicurezza

- [x] **Migrare da HTTP server locale a Electrobun RPC**: L'intera comunicazione frontend↔backend passa da un `Bun.serve()` su `localhost:3457`, accessibile da qualsiasi processo sulla macchina (CORS `*`, zero auth). Electrobun offre un sistema RPC tipizzato nativo (`BrowserView.defineRPC` / `Electroview.defineRPC`) che usa un canale interno isolato. La migrazione elimina in un colpo: server HTTP esposto, problemi CORS, necessità di auth, latenza HTTP. Definire i tipi in `src/shared/types.ts` e sostituire tutte le `fetch` nel frontend con chiamate RPC.
- [ ] **SQL Injection nelle query Drive API**: In `drive.ts`, i parametri `folderId`, `name`, `parentId` vengono interpolati direttamente nelle query string di Google Drive (`q: \`'${folderId}' in parents\``). Un folderId malevolo potrebbe manipolare la query. Usare escape o validazione degli ID.
- [ ] **API Key visibile in memoria**: L'API key per il servizio di classificazione è salvata in chiaro nel DB SQLite. Considerare l'uso del Keychain di sistema (macOS) o cifratura.
- [ ] **Path traversal nel setting key**: `PUT /api/settings/:key` accetta qualsiasi stringa come chiave. Validare che `key` sia una delle chiavi ammesse (whitelist).
- [ ] **Nessuna validazione input `body.value` nei settings**: Il valore salvato non viene validato né sanitizzato.
- [ ] **`credentials.json` presente nella root del progetto**: Il file `credentials.json` esiste nella root (visibile nel file tree). Anche se in `.gitignore`, va rimosso dal repo e spostato in `~/.arkimind/`.

### Errori e Robustezza

- [ ] **Nessun retry su errori Google Drive API**: Chiamate a Google Drive possono fallire per rate limiting (429) o errori transitori (5xx). Implementare retry con backoff esponenziale.
- [ ] **Errori di rete non gestiti nel frontend**: `api.ts` lancia eccezioni ma molti componenti le catturano solo con `console.error` senza mostrare feedback all'utente.
- [ ] **Preview di file grandi carica tutto in memoria**: `getFilePreview` scarica l'intero file e lo converte in base64. Per file da centinaia di MB questo causa crash. Limitare la dimensione o usare streaming/thumbnail.
- [ ] **Upload senza limite di dimensione**: Nessun controllo sulla dimensione dei file caricati, né lato client né lato server.
- [ ] **`parseInt` senza validazione**: In `DELETE /api/inbox-folders/:id`, `parseInt` può restituire `NaN` se l'ID non è numerico. Validare prima dell'uso.
- [ ] **Server OAuth callback su porta fissa 3000**: Basso rischio (usata solo per pochi secondi durante il login). Eventualmente gestire il caso di porta occupata con un messaggio chiaro.
- [ ] **Nessun timeout sulle chiamate fetch del frontend**: Le richieste API possono restare appese indefinitamente. Aggiungere `AbortController` con timeout.
- [ ] **`any` type usato ovunque**: Molti tipi sono `any` (documenti, classificazioni). Definire interfacce TypeScript proper per tutti i dati.

## 🟡 Problemi di Design e Architettura

### Backend

- [ ] **Routing manuale con `if/else`**: Il router HTTP è una catena di `if/else` su `pathname`. Usare un micro-router (es. pattern matching) per manutenibilità e per evitare conflitti di route (es. `/api/documents/search` vs `/api/documents/:id`).
- [ ] **Nessun logging strutturato**: Solo `console.log/error`. Implementare un logger con livelli (info, warn, error) e timestamp.
- [ ] **Database non chiuso alla chiusura dell'app**: `_db` non viene mai chiuso con `close()`. Aggiungere cleanup su shutdown.
- [ ] **Nessuna migrazione versionata del DB**: Le migrazioni sono fatte con `ALTER TABLE ADD COLUMN` ad-hoc. Usare un sistema di versioning dello schema.
- [ ] **Token OAuth non viene refreshato proattivamente**: Il refresh token è salvato ma non c'è logica per gestire la scadenza dell'access token in modo trasparente.

### Frontend

- [ ] **Stato globale assente**: Ogni componente gestisce il proprio stato con `useState`. Usare un context o state manager leggero (Zustand, Jotai) per condividere auth status, settings, e notifiche.
- [ ] **Componente modale duplicato**: Il codice del preview modal è copiato identico in `Dashboard.tsx` e `Documents.tsx`. Estrarre in un componente riutilizzabile.
- [ ] **Nessun sistema di notifiche globale**: I messaggi di errore/successo sono gestiti localmente in ogni componente. Creare un toast/notification system centralizzato.
- [ ] **`index.html` ha titolo generico**: Il titolo è "React + Tailwind + Vite" invece di "Arkimind".
- [ ] **Nessun error boundary React**: Se un componente crasha, l'intera app diventa bianca. Aggiungere `ErrorBoundary`.
- [ ] **`CATEGORY_COLORS` duplicato**: La mappa dei colori per categoria è copiata in `ClassificationResult.tsx` e `Documents.tsx`. Centralizzare.

## 🟢 Miglioramenti UI/UX

### Esperienza Utente

- [ ] **Nessun onboarding / wizard iniziale**: L'utente deve sapere già cosa fare (configurare credentials, login, aggiungere cartelle). Aggiungere un wizard di primo avvio.
- [ ] **Nessuna conferma prima dell'archiviazione**: Il click su "Archivia" sposta immediatamente il file. Aggiungere un dialog di conferma con anteprima del percorso.
- [ ] **Impossibile modificare la classificazione prima dell'archiviazione**: L'utente non può correggere categoria, ente, data o percorso suggerito dall'AI. Aggiungere form di editing.
- [ ] **Nessun feedback di progresso per upload multipli**: L'upload di più file mostra solo uno spinner generico. Aggiungere progress bar per file.
- [ ] **Ricerca documenti solo testuale**: La ricerca è un semplice `LIKE`. Aggiungere filtri per categoria, stato, data, rilevanza fiscale.
- [ ] **Nessuna paginazione**: I documenti sono caricati tutti (limit 100). Aggiungere paginazione o infinite scroll.
- [ ] **Nessun dark mode toggle**: I CSS supportano dark mode ma non c'è modo di attivarlo dall'UI.
- [ ] **Nessuna scorciatoia da tastiera**: Mancano shortcut per azioni comuni (refresh, cerca, naviga tra tab).
- [ ] **Modali non chiudibili con Escape**: I dialog modali non gestiscono il tasto Escape per la chiusura.
- [ ] **Nessun indicatore di "ultima sincronizzazione"**: L'utente non sa quando i dati sono stati aggiornati l'ultima volta.
- [ ] **Nessuna animazione di transizione tra tab**: Il cambio tab è istantaneo senza transizione.
- [ ] **Sidebar non collassabile**: Su schermi piccoli la sidebar occupa spazio fisso.

### Design Visivo

- [ ] **Nessun empty state illustrato**: Gli stati vuoti usano solo icone piccole e testo. Aggiungere illustrazioni o grafiche più accattivanti.
- [ ] **Nessun favicon / icona app**: Manca il favicon nell'HTML e l'icona dell'applicazione desktop.
- [ ] **Font di sistema di default**: Non è specificato un font personalizzato. Considerare Inter o Geist per un look più curato.

## 🔵 Funzionalità Mancanti per Competitività

### Essenziali (Must-Have)

- [ ] **Classificazione batch**: Possibilità di classificare tutti i file di una cartella con un click, non uno alla volta.
- [ ] **Archiviazione batch**: Archiviare tutti i file classificati in una volta.
- [ ] **Ricerca full-text nel contenuto dei documenti**: Attualmente si cerca solo nei metadati. Implementare OCR + indicizzazione del testo estratto.
- [ ] **Supporto multi-cloud**: Oltre a Google Drive, supportare OneDrive, Dropbox, iCloud, S3.
- [ ] **Notifiche push / monitoraggio automatico**: Rilevare automaticamente nuovi file nelle cartelle inbox e notificare l'utente.
- [ ] **Condivisione e collaborazione**: Permettere a più utenti di accedere allo stesso archivio con ruoli (viewer, editor, admin).
- [ ] **Cronologia e audit log**: Tracciare chi ha fatto cosa e quando (classificazione, archiviazione, eliminazione).
- [ ] **Undo / ripristino**: Possibilità di annullare un'archiviazione o ripristinare un file eliminato.
- [ ] **Esportazione dati**: Esportare l'elenco documenti in CSV/Excel per contabilità o revisione.
- [ ] **Backup e restore del database locale**: Permettere backup/restore delle configurazioni e dei metadati.

### Differenzianti (Nice-to-Have)

- [ ] **Dashboard con statistiche e grafici**: Numero documenti per categoria, trend temporali, spazio utilizzato, documenti fiscali per anno.
- [ ] **Regole di archiviazione personalizzabili**: L'utente definisce regole custom (es. "tutte le fatture Enel vanno in Utenze/Enel/Fatture").
- [ ] **Template di struttura archivio**: Offrire template predefiniti per la struttura delle cartelle (personale, aziendale, studio professionale).
- [ ] **Scadenze e promemoria**: Associare scadenze ai documenti (es. rinnovo assicurazione, scadenza pagamento) con notifiche.
- [ ] **Tag personalizzati**: Oltre alle categorie AI, permettere tag manuali liberi.
- [ ] **OCR integrato**: Estrarre testo da immagini e PDF scansionati direttamente nell'app.
- [ ] **Anteprima documenti migliorata**: Supportare più formati (DOCX, XLSX, TXT) e navigazione multi-pagina.
- [ ] **Versioning dei documenti**: Tracciare le versioni di un documento nel tempo.
- [ ] **App mobile companion**: Scattare foto di documenti dal telefono e inviarli direttamente all'archivio.
- [ ] **Integrazione email**: Importare allegati email direttamente nell'archivio.
- [ ] **API pubblica / webhook**: Permettere integrazioni con altri servizi (Zapier, n8n, Make).
- [ ] **Multi-lingua**: L'app è attualmente solo in italiano. Aggiungere supporto i18n.
- [ ] **Firma digitale**: Verificare e apporre firme digitali sui documenti.
- [ ] **Compressione e ottimizzazione PDF**: Ridurre la dimensione dei PDF prima dell'archiviazione.
- [ ] **Riconoscimento duplicati**: Rilevare documenti duplicati o molto simili già archiviati.
- [ ] **Retention policy**: Definire politiche di conservazione automatica (es. elimina dopo 10 anni).

## 📋 Refactoring e Qualità del Codice

- [ ] **Aggiungere test unitari e di integrazione**: Attualmente zero test. Aggiungere almeno test per `db.ts`, `auth.ts`, e le API routes.
- [ ] **Definire tipi TypeScript condivisi**: Creare un file `types.ts` condiviso tra backend e frontend per documenti, classificazioni, settings.
- [ ] **Estrarre costanti e configurazioni**: Porte, URL, limiti, categorie sono hardcoded. Centralizzare in un file di configurazione.
- [ ] **Aggiungere ESLint e Prettier**: Nessun linter configurato nel progetto.
- [ ] **CI/CD pipeline**: Aggiungere GitHub Actions per build, test, e release automatica.
- [ ] **Documentazione API**: Documentare le API REST con OpenAPI/Swagger.
