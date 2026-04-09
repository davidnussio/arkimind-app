# Arkimind — Analisi e Task List

## 🔴 Bug e Problemi Critici

### Sicurezza

- [ ] **SQL Injection nelle query Drive API**: In `drive.ts`, i parametri `folderId`, `name`, `parentId` vengono interpolati direttamente nelle query string di Google Drive (`q: \`'${folderId}' in parents\``). Un folderId malevolo potrebbe manipolare la query. Usare escape o validazione degli ID.
- [ ] **API Key visibile in memoria**: L'API key per il servizio di classificazione è salvata in chiaro nel DB SQLite. Considerare l'uso del Keychain di sistema (macOS) o cifratura.
- [ ] **Nessuna validazione input nelle RPC `saveSetting`**: La chiave e il valore passati a `saveSetting` non vengono validati. Aggiungere una whitelist di chiavi ammesse e sanitizzare il valore.
- [ ] **`credentials.json` presente nella root del progetto**: Il file `credentials.json` esiste nella root (visibile nel file tree). Anche se in `.gitignore`, va rimosso dal repo e spostato in `~/.arkimind/`.

### Errori e Robustezza

- [x] **Nessun retry su errori Google Drive API**: ~~Chiamate a Google Drive possono fallire per rate limiting (429) o errori transitori (5xx).~~ Completato: implementato `withRetry` con backoff esponenziale in `src/bun/retry.ts`, applicato a tutte le chiamate Drive API in `drive.ts`.
- [x] **Errori RPC non gestiti nel frontend**: ~~Le chiamate RPC possono lanciare eccezioni ma molti componenti le catturano solo con `console.error` senza mostrare feedback all'utente.~~ Completato: creato sistema toast globale (`Toaster.tsx` con `useToast` hook) e sostituiti tutti i `console.error` con `toastError()` in Dashboard, Documents e Settings.
- [x] **Preview di file grandi carica tutto in memoria**: ~~`getFilePreview` scarica l'intero file e lo converte in base64. Per file da centinaia di MB questo causa crash.~~ Completato: aggiunto controllo dimensione file (limite 50 MB) prima del download in `drive.ts`, con errore user-friendly propagato al frontend.
- [x] **Upload senza limite di dimensione**: ~~Nessun controllo sulla dimensione dei file caricati. L'upload via RPC (`uploadFileData`) converte l'intero file in base64 in memoria — per file grandi questo è problematico.~~ Completato: aggiunto limite 100 MB con validazione sia in `drive.ts` (`uploadFile`) che nel handler RPC `uploadFileData` in `index.ts`.
- [x] **`parseInt` senza validazione**: ~~In `DELETE /api/inbox-folders/:id`, `parseInt` poteva restituire `NaN`.~~ Risolto: con RPC tipizzato il parametro `id` è già tipizzato come `number` nello schema.
- [x] **Server OAuth callback su porta fissa 3000**: ~~Basso rischio (usata solo per pochi secondi durante il login).~~ Completato: aggiunta funzione `findAvailablePort` in `auth.ts` che prova la porta 3000 e, se occupata, usa una porta disponibile assegnata dal sistema.
- [x] **Nessun timeout sulle chiamate fetch del frontend**: ~~Le richieste API potevano restare appese indefinitamente.~~ Risolto: Electrobun RPC ha `maxRequestTime: 120_000` configurato sia lato bun che webview.
- [x] **`any` type usato in alcuni punti**: ~~I tipi principali sono definiti in `src/shared/types.ts`, ma `classification` è ancora `any`.~~ Completato: definite interfacce `ClassificationResult`, `DocumentProfile`, `FilingStrategy`, `FinancialData`, `AiAnalysis` in `types.ts`. Tipizzato `EnrichedDriveFile.classification` e lo schema RPC `classifyFile`. Aggiunta cache preview con eviction (TTL 5min, max 20 entries).

## 🟡 Problemi di Design e Architettura

### Backend

- [x] **Routing manuale con `if/else`**: ~~Il router HTTP era una catena di `if/else` su `pathname`.~~ Risolto: il server HTTP è stato eliminato. Le operazioni sono ora handler RPC tipizzati in `src/bun/index.ts`, con dispatch automatico di Electrobun.
- [ ] **Nessun logging strutturato**: Solo `console.log/error`. Implementare un logger con livelli (info, warn, error) e timestamp.
- [ ] **Database non chiuso alla chiusura dell'app**: `_db` non viene mai chiuso con `close()`. Aggiungere cleanup su shutdown.
- [ ] **Nessuna migrazione versionata del DB**: Le migrazioni sono fatte con `ALTER TABLE ADD COLUMN` ad-hoc. Usare un sistema di versioning dello schema.
- [ ] **Token OAuth non viene refreshato proattivamente**: Il refresh token è salvato ma non c'è logica per gestire la scadenza dell'access token in modo trasparente.
- [x] **Preview cache senza eviction**: ~~`previewCache` in `index.ts` è una `Map` in memoria senza limite di dimensione né TTL.~~ Completato: aggiunto TTL di 5 minuti e limite massimo di 20 entries con eviction automatica in `index.ts`.

### Frontend

- [ ] **Stato globale assente**: Ogni componente gestisce il proprio stato con `useState`. Usare un context o state manager leggero (Zustand, Jotai) per condividere auth status, settings, e notifiche.
- [x] **Componente modale duplicato**: ~~Il codice del preview modal è copiato identico in `Dashboard.tsx` e `Documents.tsx`.~~ Completato: estratto componente riutilizzabile `PreviewModal` con gestione Escape e click su overlay, usato in entrambi i componenti.
- [x] **Nessun sistema di notifiche globale**: ~~I messaggi di errore/successo sono gestiti localmente in ogni componente.~~ Completato: creato `Toaster.tsx` con `ToastProvider` e `useToast` hook. Toast globali con 4 livelli (success/error/warning/info), auto-dismiss, max 5 visibili. Integrato in Dashboard, Documents e Settings.
- [x] **`index.html` ha titolo generico**: ~~Il titolo è "React + Tailwind + Vite" invece di "Arkimind".~~ Completato: titolo già impostato a "Arkimind", lang="it" e favicon SVG presenti.
- [x] **Nessun error boundary React**: ~~Se un componente crasha, l'intera app diventa bianca.~~ Completato: creato `ErrorBoundary.tsx` con UI di recovery (messaggio errore + pulsante "Riprova"), wrappato attorno all'intera app in `main.tsx`.
- [x] **`CATEGORY_COLORS` duplicato**: ~~La mappa dei colori per categoria è copiata in `ClassificationResult.tsx` e `Documents.tsx`.~~ Completato: centralizzato in `src/mainview/lib/constants.ts` e importato in entrambi i componenti.

## 🟢 Miglioramenti UI/UX

### Esperienza Utente

- [x] **Nessun onboarding / wizard iniziale**: ~~L'utente deve sapere già cosa fare.~~ Completato: creato componente `OnboardingWizard` con 6 step (welcome, auth, api, archive, inbox, done) che guida l'utente nella configurazione iniziale.
- [x] **Nessuna conferma prima dell'archiviazione**: ~~Il click su "Archivia" sposta immediatamente il file.~~ Completato: creato `ArchiveConfirmDialog` che mostra anteprima del percorso di destinazione prima di procedere.
- [x] **Impossibile modificare la classificazione prima dell'archiviazione**: ~~L'utente non può correggere categoria, ente, data o percorso suggerito dall'AI.~~ Completato: creato `ClassificationEditor` con form per modificare categoria, ente, tipo, data, percorso e nome file. Pulsante "Modifica" aggiunto in `ClassificationResult` e nella lista file della Dashboard.
- [x] **Nessun feedback di progresso per upload multipli**: ~~L'upload di più file mostra solo uno spinner generico.~~ Completato: creato componente `UploadProgress` con progress bar globale e stato per-file (pending/uploading/done/error).
- [x] **Ricerca documenti solo testuale**: ~~La ricerca è un semplice `LIKE`.~~ Completato: aggiunto pannello filtri avanzati in `Documents` con dropdown per categoria, stato e rilevanza fiscale, applicati lato client sui risultati.
- [x] **Nessuna paginazione**: ~~I documenti sono caricati tutti (limit 100).~~ Completato: aggiunta paginazione client-side con 20 documenti per pagina e navigazione prev/next.
- [x] **Nessun dark mode toggle**: ~~I CSS supportano dark mode ma non c'è modo di attivarlo dall'UI.~~ Completato: aggiunto toggle dark/light mode nella sidebar con persistenza in localStorage e rispetto della preferenza di sistema come default.
- [x] **Nessuna scorciatoia da tastiera**: ~~Mancano shortcut per azioni comuni.~~ Completato: aggiunte scorciatoie ⌘1/2/3 (tab), ⌘K (cerca), ⌘R (refresh), ⌘B (sidebar), ⌘/ (help scorciatoie), Esc (chiudi modali). Dialog help accessibile dalla sidebar.
- [x] **Modali non chiudibili con Escape**: ~~I dialog modali non gestiscono il tasto Escape.~~ Completato: tutti i modali (PreviewModal, ClassificationResult, ClassificationEditor, ArchiveConfirmDialog, FolderBrowser, DeleteDialog, DocumentDetailDialog, ShortcutsDialog) ora gestiscono Escape e click su overlay.
- [x] **Nessun indicatore di "ultima sincronizzazione"**: ~~L'utente non sa quando i dati sono stati aggiornati l'ultima volta.~~ Completato: aggiunto indicatore "Ultimo aggiornamento: HH:MM" nella sidebar, aggiornato ad ogni refresh della Dashboard.
- [x] **Nessuna animazione di transizione tra tab**: ~~Il cambio tab è istantaneo senza transizione.~~ Completato: aggiunta animazione fade-in con leggero slide-up (200ms) al cambio tab tramite CSS keyframes.
- [x] **Sidebar non collassabile**: ~~Su schermi piccoli la sidebar occupa spazio fisso.~~ Completato: sidebar collassabile con transizione animata (w-52 ↔ w-14), toggle nella sidebar e shortcut ⌘B. In modalità compressa mostra solo icone con tooltip.

### Design Visivo

- [x] **Nessun empty state illustrato**: ~~Gli stati vuoti usano solo icone piccole e testo.~~ Completato: creato componente `EmptyState` con illustrazioni SVG dedicate (folder, document, search) usato in Dashboard, Documents e Settings.
- [x] **Nessun favicon / icona app**: ~~Manca il favicon nell'HTML e l'icona dell'applicazione desktop.~~ Completato: aggiunto favicon SVG inline con logo Arkimind, titolo HTML corretto a "Arkimind", lang impostato a "it".
- [x] **Font di sistema di default**: ~~Non è specificato un font personalizzato.~~ Completato: aggiunto font Inter da Google Fonts come font di default nell'app.

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
- [x] **Definire tipi TypeScript condivisi**: Completato: `src/shared/types.ts` contiene i tipi di dominio (`AppSettings`, `InboxFolder`, `DriveFileInfo`, `DocumentRecord`, ecc.) e lo schema RPC `ArkimindRPC` condiviso tra backend e frontend. Resta da tipizzare `classification` (attualmente `any`).
- [ ] **Estrarre costanti e configurazioni**: Porte, URL, limiti, categorie sono hardcoded (es. `CHUNK_SIZE`, `maxRequestTime`, `DEV_SERVER_PORT`). Centralizzare in un file di configurazione.
- [ ] **Aggiungere ESLint e Prettier**: Nessun linter configurato nel progetto.
- [ ] **CI/CD pipeline**: Aggiungere GitHub Actions per build, test, e release automatica.
- [ ] **Documentazione RPC**: Documentare gli handler RPC disponibili, i parametri e le risposte. Lo schema tipizzato in `types.ts` è già una buona base, ma aggiungere JSDoc e un README per sviluppatori.
