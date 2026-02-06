
import React from 'react';
import Papa from 'papaparse';
import { Download, RotateCcw, CheckCircle, AlertCircle } from 'lucide-react';
import { DAYS } from '../utils/scheduler';

export function ScheduleTable({ schedule, onReset, onShiftUpdate }) {

    const exportCSV = () => {
        // Flatten for export with EXACT columns requested
        // Format: Nome, Ore Contratto, Esigenze/Preferenze, Lun, Mar, Mer, Gio, Ven, Sab, Dom
        const exportData = schedule.map(emp => {
            return {
                'Nome': emp.Nome,
                'Ore Contratto': emp['Ore Contratto'],
                'Esigenze/Preferenze': emp['Esigenze/Preferenze'],
                'Lun': emp.shifts.Lun,
                'Mar': emp.shifts.Mar,
                'Mer': emp.shifts.Mer,
                'Gio': emp.shifts.Gio,
                'Ven': emp.shifts.Ven,
                'Sab': emp.shifts.Sab,
                'Dom': emp.shifts.Dom
            };
        });

        const csv = Papa.unparse(exportData, {
            delimiter: ";", // Force semi-colon for Excel compatibility in EU
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'turni_generati.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="w-full max-w-7xl mx-auto mt-6 sm:mt-8 bg-white rounded-xl shadow-xl overflow-hidden animate-in fade-in duration-500">
            <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50/50">
                <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-slate-800">Turni Generati</h2>
                    <p className="text-slate-500 text-sm">Controlla e scarica la programmazione settimanale</p>
                </div>
                <div className="flex flex-wrap sm:flex-nowrap gap-2 sm:gap-3 w-full sm:w-auto">
                    <button
                        onClick={onReset}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-4 py-2 text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm font-medium text-sm"
                    >
                        <RotateCcw className="w-4 h-4" />
                        Carica nuovo
                    </button>
                    <button
                        onClick={exportCSV}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-200 font-medium text-sm"
                    >
                        <Download className="w-4 h-4" />
                        Esporta CSV
                    </button>
                </div>
            </div>

            <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 text-slate-500 text-sm uppercase tracking-wider">
                            <th className="p-4 font-semibold border-b border-slate-200">Dipendente</th>
                            <th className="p-4 font-semibold border-b border-slate-200">Contratto</th>
                            <th className="p-4 font-semibold border-b border-slate-200 text-center">Ore</th>
                            {DAYS.map(day => (
                                <th key={day} className="p-4 font-semibold border-b border-slate-200">{day}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {schedule.map((emp, idx) => {
                            const contract = parseInt(emp['Ore Contratto']) || 0;
                            const assigned = emp.assignedHours;
                            const isMet = assigned >= contract;
                            const isOver = assigned > contract;

                            return (
                                <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="p-4 font-medium text-slate-800">
                                        {emp.Nome}
                                        <div className="text-xs text-slate-400 font-normal mt-0.5 max-w-[150px] truncate" title={emp['Esigenze/Preferenze']}>
                                            {emp['Esigenze/Preferenze']}
                                        </div>
                                    </td>
                                    <td className="p-4 text-slate-600">{contract}h</td>
                                    <td className="p-4 text-center">
                                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${isMet && !isOver ? 'bg-green-100 text-green-700' :
                                            isOver ? 'bg-amber-100 text-amber-700' :
                                                'bg-red-100 text-red-700'
                                            }`}>
                                            {isMet ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                                            {assigned}h
                                        </div>
                                    </td>
                                    {DAYS.map(day => (
                                        <td key={day} className="p-2">
                                            <textarea
                                                className={`w-full text-xs font-medium px-2 py-1 bg-indigo-50 text-indigo-700 rounded border border-indigo-100 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all text-center placeholder-slate-300 resize-none overflow-hidden ${(emp.shifts[day] || '').includes('/') ? 'min-h-[3.5rem] py-2' : 'h-8'
                                                    }`}
                                                value={(emp.shifts[day] || '').replace(/\s*\/\s*/g, '\n')}
                                                placeholder="-"
                                                rows={(emp.shifts[day] || '').includes('/') ? 2 : 1}
                                                onChange={(e) => {
                                                    // Convert newlines to " / " for storage
                                                    const val = e.target.value.replace(/\n/g, ' / ');
                                                    onShiftUpdate(idx, day, val);
                                                }}
                                            />
                                        </td>
                                    ))}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
