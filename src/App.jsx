
import React, { useState } from 'react';
import { UploadSection } from './components/UploadSection';
import { ScheduleTable } from './components/ScheduleTable';
import { generateSchedule } from './utils/scheduler';
import { BrainCircuit } from 'lucide-react';

function App() {
  const [schedule, setSchedule] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleDataLoaded = (data, settings) => {
    setIsGenerating(true);
    // Simulate AI processing delay for effect
    setTimeout(() => {
      const generated = generateSchedule(data, settings);
      setSchedule(generated);
      setIsGenerating(false);
    }, 1500);
  };

  const handleReset = () => {
    setSchedule(null);
  };

  const handleShiftUpdate = (empIndex, day, newShift) => {
    setSchedule(prevSchedule => {
      const newSchedule = [...prevSchedule];
      const emp = { ...newSchedule[empIndex] };
      emp.shifts = { ...emp.shifts, [day]: newShift };

      // Recalculate total hours
      let totalHours = 0;
      Object.values(emp.shifts).forEach(shift => {
        if (!shift) return;
        try {
          // Support formats: "09:00 - 13:00" or just "4" (if user types number)
          if (shift.includes('-')) {
            const [s, e] = shift.replace(/ /g, '').split('-');
            const start = parseInt(s.split(':')[0]);
            const end = parseInt(e.split(':')[0]);
            if (!isNaN(start) && !isNaN(end)) {
              totalHours += (end - start);
            }
          } else {
            // If user enters simple number like "8", treat as hours.
            // Or if usage of other format...
            // For now, let's keep it simple: strict format or no calc
          }
        } catch (e) { }
      });

      emp.assignedHours = totalHours;
      newSchedule[empIndex] = emp;
      return newSchedule;
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-2 rounded-lg text-white">
              <BrainCircuit className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600">
              AI Shift Scheduler
            </h1>
          </div>
          <div className="text-sm text-slate-500">
            Gestione Turni Intelligente
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 pt-10">
        {!schedule && !isGenerating && (
          <div className="text-center space-y-4 mb-10">
            <h2 className="text-4xl font-extrabold text-slate-800 tracking-tight">
              Ottimizza i turni con l'AI
            </h2>
            <p className="text-slate-600 max-w-2xl mx-auto text-lg leading-relaxed">
              Carica il file CSV con i dati dei dipendenti. Il nostro sistema analizzerà contratti e preferenze per generare la settimana lavorativa perfetta.
            </p>
            <UploadSection onDataLoaded={handleDataLoaded} />

            <div className="mt-12 text-left bg-white p-6 rounded-xl border border-slate-200 shadow-sm max-w-2xl mx-auto">
              <h4 className="font-semibold text-slate-900 mb-2">Formato CSV Richiesto:</h4>
              <code className="block bg-slate-100 p-3 rounded text-xs text-slate-700 font-mono overflow-x-auto">
                Nome, Ore Contratto, Esigenze/Preferenze, Lun, Mar, Mer, Gio, Ven, Sab, Dom
              </code>
              <p className="text-xs text-slate-500 mt-2">
                Le colonne dei giorni (Lun...Dom) possono essere vuote, verranno compilate automaticamente.
              </p>
            </div>
          </div>
        )}

        {isGenerating && (
          <div className="flex flex-col items-center justify-center py-20 animate-in fade-in duration-700">
            <div className="relative w-20 h-20 mb-8">
              <div className="absolute inset-0 border-4 border-indigo-100 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
              <BrainCircuit className="absolute inset-0 m-auto w-8 h-8 text-indigo-600 animate-pulse" />
            </div>
            <h3 className="text-2xl font-bold text-slate-800 mb-2">Analisi in corso...</h3>
            <p className="text-slate-500">Sto calcolando le combinazioni migliori per i turni.</p>
          </div>
        )}

        {schedule && (
          <ScheduleTable schedule={schedule} onReset={handleReset} onShiftUpdate={handleShiftUpdate} />
        )}
      </main>
    </div>
  );
}

export default App;
