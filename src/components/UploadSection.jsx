
import React, { useCallback } from 'react';
import Papa from 'papaparse';
import { UploadCloud, FileSpreadsheet } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function UploadSection({ onDataLoaded }) {
    const [settings, setSettings] = React.useState({
        closedDay: 'None',
        openTime: '09:00',
        closeTime: '21:00'
    });
    const [parsedData, setParsedData] = React.useState(null);
    const [fileName, setFileName] = React.useState('');

    const handleFile = useCallback((file) => {
        if (file) {
            setFileName(file.name);
            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => {
                    // Basic validation
                    if (results.data && results.data.length > 0) {
                        // Check if columns exist
                        const firstRow = results.data[0];
                        if ('Nome' in firstRow && 'Ore Contratto' in firstRow) {
                            setParsedData(results.data);
                        } else {
                            alert("CSV non valido. Assicurati che ci siano le colonne 'Nome' e 'Ore Contratto'.");
                            setParsedData(null);
                            setFileName('');
                        }
                    }
                },
                error: (err) => {
                    console.error("Error parsing CSV:", err);
                    alert("Errore durante la lettura del CSV.");
                    setParsedData(null);
                    setFileName('');
                }
            });
        }
    }, []);

    const handleOptimize = () => {
        if (parsedData) {
            onDataLoaded(parsedData, settings);
        }
    };

    const onDrop = (e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        handleFile(file);
    };

    const onDragOver = (e) => {
        e.preventDefault();
    };

    const onChange = (e) => {
        const file = e.target.files[0];
        handleFile(file);
    };

    return (
        <div className="max-w-xl mx-auto mt-10 space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                    ⚙️ Impostazioni Negozio
                </h3>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1">Giorno di Chiusura</label>
                        <select
                            value={settings.closedDay}
                            onChange={(e) => setSettings({ ...settings, closedDay: e.target.value })}
                            className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        >
                            <option value="None">Nessuno (Aperto 7/7)</option>
                            <option value="Lun">Lunedì</option>
                            <option value="Mar">Martedì</option>
                            <option value="Mer">Mercoledì</option>
                            <option value="Gio">Giovedì</option>
                            <option value="Ven">Venerdì</option>
                            <option value="Sab">Sabato</option>
                            <option value="Dom">Domenica</option>
                        </select>
                    </div>
                    <div className="col-span-1 grid grid-cols-2 gap-2">
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1">Apertura</label>
                            <input
                                type="time"
                                value={settings.openTime}
                                onChange={(e) => setSettings({ ...settings, openTime: e.target.value })}
                                className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1">Chiusura</label>
                            <input
                                type="time"
                                value={settings.closeTime}
                                onChange={(e) => setSettings({ ...settings, closeTime: e.target.value })}
                                className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div
                className={twMerge(
                    "p-8 border-2 border-dashed rounded-2xl bg-white/50 backdrop-blur-sm hover:bg-white/80 transition-all cursor-pointer text-center group",
                    parsedData ? "border-green-300 bg-green-50/30" : "border-indigo-300"
                )}
                onDrop={onDrop}
                onDragOver={onDragOver}
            >
                <input type="file" accept=".csv" onChange={onChange} className="hidden" id="csv-upload" />
                <label htmlFor="csv-upload" className="cursor-pointer flex flex-col items-center">
                    <div className={twMerge(
                        "p-4 rounded-full mb-4 group-hover:scale-110 transition-transform",
                        parsedData ? "bg-green-100" : "bg-indigo-50"
                    )}>
                        <UploadCloud className={twMerge("w-10 h-10", parsedData ? "text-green-600" : "text-indigo-600")} />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2">
                        {parsedData ? "File Caricato con Successo" : "Importa Dati Dipendenti"}
                    </h3>
                    <p className="text-slate-500 mb-6 font-medium">
                        {fileName ? (
                            <span className="text-indigo-600">📄 {fileName}</span>
                        ) : (
                            "Trascina qui il tuo file CSV o clicca per cercare"
                        )}
                    </p>

                    <div className="flex items-center gap-2 text-sm text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                        <FileSpreadsheet className="w-4 h-4" />
                        <span>Formato: Nome; Ore Contratto; Esigenze; Lun...Dom; Lun_W1...Dom_W3</span>
                    </div>
                </label>
            </div>

            {parsedData && (
                <div className="animate-in slide-in-from-bottom duration-500">
                    <button
                        onClick={handleOptimize}
                        className="w-full py-4 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-bold text-lg shadow-lg shadow-indigo-200 hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
                    >
                        🚀 Ottimizza Turni
                    </button>
                    <p className="text-center text-xs text-slate-400 mt-2">
                        Clicca per calcolare la distribuzione ottimale basata sui parametri sopra.
                    </p>
                </div>
            )}
        </div>
    );
}
