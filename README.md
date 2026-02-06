# AI Shift Scheduler | Sportway

Web application avanzata per l'ottimizzazione automatizzata dei turni dei dipendenti, personalizzata per l'identità visiva di **Sportway**.

## 🚀 Guida Rapida per Sviluppatori

Per chi desidera utilizzare o modificare il software, seguire questi passaggi:

1.  **Installazione Dipendenze**: Prima di ogni cosa, è necessario installare i moduli di Node.js:
    ```bash
    npm install
    ```
2.  **Avvio in Sviluppo**: Per lanciare l'applicazione localmente:
    ```bash
    npm run dev
    ```

## 🧠 Logica Interna (Scheduler)

Il cuore pulsante dell'applicazione risiede nel file:
`src/utils/scheduler.js`

Questo file contiene l'algoritmo di **generazione intelligente**. Ecco come lavora:
- **Analisi Contrattuale**: Verifica le ore settimanali previste dal contratto di ogni dipendente.
- **Gestione Preferenze**: Analizza le stringhe di testo (es. "solo mattina", "no Martedì") per incastrare i turni senza conflitti.
- **Storico Lavorativo**: Considera le settimane precedenti per garantire una rotazione equa (es. non assegnare sempre lo stesso turno di chiusura alla stessa persona).
- **Copertura Negozio**: Garantisce che il negozio sia sempre coperto durante gli orari di apertura definiti, rispettando i giorni di chiusura.

## 🛠️ Funzionamento della WebApp

L'applicazione segue un flusso di lavoro lineare e intuitivo:

1.  **Configurazione Negozio**: L'utente definisce orari di apertura/chiusura e seleziona i reparti e i giorni di chiusura.
2.  **Importazione Dati**: Si carica un file CSV contenente i nomi dei dipendenti, le ore di contratto e le preferenze.
3.  **Ottimizzazione AI**: Cliccando su "Ottimizza Turni", l'algoritmo calcola la distribuzione ideale dei turni.
4.  **Revisione Interattiva**: I turni generati appaiono in una tabella dinamica dove è possibile apportare modifiche manuali dell'ultimo minuto.
5.  **Esportazione**: Premendo "Esporta CSV", viene generato un file pronto per l'uso (es. per Excel) con la programmazione settimanale completa.

## 🎨 Design & Responsività

- **Branding**: Completamente integrata con il logo e i colori (Rosso Sportway) dell'azienda.
- **Mobile First**: L'app è ottimizzata per essere consultata comodamente da smartphone, tablet o PC, con tabelle scrollabili e griglie adattive.
