
export const DAYS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

// Number of historical weeks to analyze (plus current week = 4 total)
export const HISTORY_WEEKS = 3;

// Suffixes for historical week columns (W1 = last week, W2 = 2 weeks ago, W3 = 3 weeks ago)
export const HISTORY_SUFFIXES = ['_W1', '_W2', '_W3'];

// Weights for historical data (more recent = higher weight)
const HISTORY_WEIGHTS = {
    current: 1.0,  // Current week (if has data)
    W1: 0.5,       // Last week - 50%
    W2: 0.3,       // 2 weeks ago - 30%
    W3: 0.2        // 3 weeks ago - 20%
};

/**
 * Parses preferences string into structured constraints
 * @param {string} pref - "No weekend", "No Lun", "Solo Ven", etc.
 * @returns {Object} - structured preferences
 */
function parsePreferences(pref) {
    const p = pref.toLowerCase();
    const parts = p.split(/[,;]|\be\b/).map(s => s.trim()).filter(Boolean);

    const dayOverrides = {}; // Day -> { morningOnly, afternoonOnly, etc. }

    // Helper to extract flags from a string fragment
    const getFlags = (fragment) => {
        return {
            morningOnly: fragment.includes('mattina') || fragment.includes('mattino') || fragment.includes('am') || fragment.includes('apertura'),
            afternoonOnly: fragment.includes('pomeriggio') || fragment.includes('pm') || fragment.includes('sera') || fragment.includes('chiusura'),
            midDayOnly: fragment.includes('intermedio') || fragment.includes('centrale'),
            splitShift: fragment.includes('spezzato')
        };
    };

    // General Flags (fallback)
    const generalFlags = getFlags(p);

    const isWeekend = p.includes('weekend') || p.includes('sabato') || p.includes('domenica');
    const isNo = p.includes('no') || p.includes('mai');
    const blockedDays = new Set();
    const requiredDays = new Set();
    const isLongWeekend = p.includes('lungo') || p.includes('long');

    // Parsing specific tokens/parts
    parts.forEach(part => {
        let matchedDay = false;
        DAYS.forEach(day => {
            const dLower = day.toLowerCase();
            // Use word boundary to avoid matching 'lun' in 'lungo'
            const dayRegex = new RegExp(`\\b${dLower}(edi|edì)?\\b`, 'i');

            if (dayRegex.test(part)) {
                matchedDay = true;

                // If it's a specific day, check for "no" or "solo" or specific shifts
                if (part.includes('no ') || (isNo && !part.includes('weekend') && part.includes(dLower))) {
                    blockedDays.add(day);
                } else if (part.includes('solo ') || part.includes('only ')) {
                    requiredDays.add(day);
                }

                // Get shift flags for this specific day
                const flags = getFlags(part);
                if (flags.morningOnly || flags.afternoonOnly || flags.midDayOnly || flags.splitShift) {
                    dayOverrides[day] = flags;
                }
            }
        });

        // Check for general weekend logic (independent of specific day matching)
        const partIsLong = part.includes('lungo') || part.includes('long');
        if (part.includes('weekend') || part.includes('sabato') || part.includes('domenica')) {
            if (part.includes('no')) {
                blockedDays.add('Sab'); blockedDays.add('Dom');
                if (partIsLong) blockedDays.add('Ven');
            } else if (part.includes('solo') || part.includes('only')) {
                requiredDays.add('Sab'); requiredDays.add('Dom');
                if (partIsLong) requiredDays.add('Ven');
            }
        }
    });

    return {
        ...generalFlags,
        noWeekend: isNo && isWeekend && !isLongWeekend,
        weekendOnly: !isNo && (p.trim() === 'weekend' || ((p.includes('solo') || p.includes('only')) && isWeekend && !isLongWeekend)),
        blockedDays,
        requiredDays,
        dayOverrides
    };
}

/**
 * Analyze past shifts across multiple weeks to find preferred patterns.
 * Supports weighted scoring (recent weeks matter more) and day-specific preferences.
 */
function analyzeMultiWeekHistory(employee) {
    const dailyPatterns = {}; // Day -> { shift: score }
    const generalShiftScores = {}; // shift -> total score
    const restDayScores = {}; // Day -> score (how often they are off)

    DAYS.forEach(day => {
        dailyPatterns[day] = {};
        restDayScores[day] = 0;

        // Check columns: Current, _W1, _W2, _W3
        const versions = [
            { key: day, weight: HISTORY_WEIGHTS.current },
            ...HISTORY_SUFFIXES.map((suffix, i) => ({
                key: `${day}${suffix}`,
                weight: HISTORY_WEIGHTS[`W${i + 1}`]
            }))
        ];

        versions.forEach(v => {
            const shift = employee[v.key];
            if (!shift || shift === '' || shift === 'CHIUSO') {
                restDayScores[day] += v.weight;
                return;
            }

            // If it's a valid shift (contains a dash)
            if (shift.includes('-')) {
                // Day specific score
                dailyPatterns[day][shift] = (dailyPatterns[day][shift] || 0) + v.weight;
                // General score
                generalShiftScores[shift] = (generalShiftScores[shift] || 0) + v.weight;
            }
        });
    });

    // Determine the most common shift overall
    let mostCommonShift = null;
    let maxGeneralScore = 0;
    Object.entries(generalShiftScores).forEach(([shift, score]) => {
        if (score > maxGeneralScore) {
            maxGeneralScore = score;
            mostCommonShift = shift;
        }
    });

    // Determine specific preference for each day
    const preferredByDay = {};
    const recurringRestDays = new Set();

    DAYS.forEach(day => {
        let bestDayShift = null;
        let maxDayScore = 0;
        Object.entries(dailyPatterns[day]).forEach(([shift, score]) => {
            if (score > maxDayScore) {
                maxDayScore = score;
                bestDayShift = shift;
            }
        });
        preferredByDay[day] = bestDayShift;

        // If a day is off > 70% of the weighted time, mark as recurring rest day
        // Max weight per day is 1.0 + 0.5 + 0.3 + 0.2 = 2.0
        if (restDayScores[day] >= 1.4) {
            recurringRestDays.add(day);
        }
    });

    return {
        mostCommonShift,
        preferredByDay,
        recurringRestDays
    };
}

/**
 * The "AI" Scheduling Function
 * Uses a greedy constraint satisfaction approach with randomization for variety.
 */
export function generateSchedule(employees, settings) {
    // Default settings if not provided
    const storeSettings = {
        closedDay: settings?.closedDay || 'None',
        openTime: settings?.openTime || '09:00',
        closeTime: settings?.closeTime || '21:00'
    };

    // Calculate store hours duration
    const openH = parseInt(storeSettings.openTime.split(':')[0]);
    const closeH = parseInt(storeSettings.closeTime.split(':')[0]);
    const totalStoreHours = closeH - openH;

    // Define dynamic shifts based on store hours
    const midPoint = Math.floor(openH + (totalStoreHours / 2));

    // Standard Coverage Shifts
    const SHIFT_MORN_DYNAMIC = `${storeSettings.openTime} - ${midPoint}:00`;
    const SHIFT_AFT_DYNAMIC = `${midPoint}:00 - ${storeSettings.closeTime}`;
    // Mid-day shift for peak coverage
    const peakStart = Math.floor(openH + (totalStoreHours * 0.25));
    const peakEnd = Math.floor(closeH - (totalStoreHours * 0.25));
    const SHIFT_MID_DYNAMIC = `${peakStart}:00 - ${peakEnd}:00`;

    // Split Shift: 4h Morning + 4h Evening
    const splitMorningEnd = openH + 4;
    const splitEveningStart = closeH - 4;
    const SHIFT_SPLIT_DYNAMIC = `${storeSettings.openTime} - ${splitMorningEnd}:00 / ${splitEveningStart}:00 - ${storeSettings.closeTime}`;

    const canDoFullDay = totalStoreHours <= 9;
    const SHIFT_FULL_DYNAMIC = `${storeSettings.openTime} - ${storeSettings.closeTime}`;
    const halfShiftDuration = Math.floor(totalStoreHours / 2);

    // Deep copy and Pre-process
    const schedule = employees.map(emp => {
        const shifts = {};

        // Smart Initialization:
        // - Digits (Time) -> Ignore (let AI regenerate based on history/needs)
        // - Text (Ferie/Malattia) -> Keep (Lock this day)
        DAYS.forEach(day => {
            const raw = emp[day] || '';
            // If it contains a digit (0-9), we assume it's a time -> Clear it from "assigned" so AI can regenerate
            // If it's pure text (Ferie, Malattia, Chiuso) -> Keep it locked
            if (/[0-9]/.test(raw)) {
                shifts[day] = '';
            } else {
                shifts[day] = raw;
            }
        });

        // Calculate initially assigned hours from imported shifts
        let initialHours = 0;
        Object.values(shifts).forEach(s => {
            if (!s || s === 'CHIUSO') return;
            try {
                // Determine segments (single or split)
                const segments = s.includes('/') ? s.split('/') : [s];

                segments.forEach(seg => {
                    if (!seg || !seg.includes('-')) return;
                    // Remove ALL whitespace
                    const cleaned = seg.replace(/\s/g, '');
                    const [startStr, endStr] = cleaned.split('-');

                    if (startStr && endStr) {
                        const start = parseInt(startStr);
                        const end = parseInt(endStr);
                        if (!isNaN(start) && !isNaN(end)) {
                            initialHours += (end - start);
                        }
                    }
                });
            } catch (e) { }
        });

        return {
            ...emp,
            parsedPrefs: parsePreferences(emp['Esigenze/Preferenze'] || ''),
            historyAnalysis: analyzeMultiWeekHistory(emp), // Deep analysis of patterns
            assignedHours: initialHours,
            shifts: shifts
        };
    });

    // Randomize order of employees slightly
    const shuffledEmployees = [...schedule].sort(() => Math.random() - 0.5);

    // Helper to add hours
    const assignShift = (emp, day, shift, hours) => {
        emp.shifts[day] = shift;
        emp.assignedHours += hours;
    };

    for (const day of DAYS) {
        // Checking closing day
        if (day === storeSettings.closedDay) {
            shuffledEmployees.forEach(emp => {
                emp.shifts[day] = 'CHIUSO';
            });
            continue;
        }

        const isWeekend = day === 'Sab' || day === 'Dom';

        // Sort: Priority to those who NEED hours
        shuffledEmployees.sort((a, b) => {
            // Priority 1: Required Days (Solo X)
            const aReq = a.parsedPrefs.requiredDays.has(day);
            const bReq = b.parsedPrefs.requiredDays.has(day);
            if (aReq && !bReq) return -1;
            if (!aReq && bReq) return 1;

            // Priority 2: Weekend Only people on Weekends
            if (isWeekend) {
                if (a.parsedPrefs.weekendOnly && !b.parsedPrefs.weekendOnly) return -1;
                if (!a.parsedPrefs.weekendOnly && b.parsedPrefs.weekendOnly) return 1;
            } else {
                if (a.parsedPrefs.weekendOnly && !b.parsedPrefs.weekendOnly) return 1;
                if (!a.parsedPrefs.weekendOnly && b.parsedPrefs.weekendOnly) return -1;
            }
            // Priority 3: Specific Constraints (Morning/Afternoon/Split/MidDay)
            // Giving priority to people with limited availability so they get their spots
            const aPref = a.parsedPrefs.morningOnly || a.parsedPrefs.afternoonOnly || a.parsedPrefs.midDayOnly || a.parsedPrefs.splitShift;
            const bPref = b.parsedPrefs.morningOnly || b.parsedPrefs.afternoonOnly || b.parsedPrefs.midDayOnly || b.parsedPrefs.splitShift;
            if (aPref && !bPref) return -1;
            if (!aPref && bPref) return 1;

            // Priority 4: Distance from contract target (Largest gap first)
            const aRem = (parseInt(a['Ore Contratto']) || 0) - a.assignedHours;
            const bRem = (parseInt(b['Ore Contratto']) || 0) - b.assignedHours;
            return bRem - aRem;
        });

        // TRACK COVERAGE: We count how many people are on each "slot"
        let countMorning = 0;
        let countAfternoon = 0;
        let countOpen = 0;
        let countClose = 0;

        // --- PASS 1: Fill based on Coverage & Preferences ---
        for (const emp of shuffledEmployees) {
            const contract = parseInt(emp['Ore Contratto']) || 0;
            if (emp.assignedHours >= contract) continue;
            if (emp.shifts[day]) continue; // Already assigned today?

            // --- CHECK CONSTRAINTS ---
            // 1. Manual Blocked Days ("No Lun")
            if (emp.parsedPrefs.blockedDays.has(day)) continue;
            // 2. Required Days Logic: If they have "Solo Mar", they should implicitly be blocked on other days?
            // Usually "Solo X" implies "Only X".
            if (emp.parsedPrefs.requiredDays.size > 0 && !emp.parsedPrefs.requiredDays.has(day)) {
                // If they have explicit "Solo ..." requirements and TODAY is not one of them, skip.
                continue;
            }

            if (emp.parsedPrefs.noWeekend && isWeekend) continue;
            if (emp.parsedPrefs.weekendOnly && !isWeekend) continue;

            // 3. Recurring Rest Day (Implicit Constraint from History)
            // If they are usually off this day, and we don't have a critical need for them, skip.
            const isRecurringRest = emp.historyAnalysis.recurringRestDays.has(day);
            if (isRecurringRest && !emp.parsedPrefs.requiredDays.has(day)) {
                // Soft skip: if someone else can do it, we'll find them in this loop
                // But we don't "continue" hard here to avoid under-staffing if NO ONE else is available
                // Actually, let's keep it as a very strong preference:
                const otherStaffAvailable = shuffledEmployees.some(other =>
                    other.Nome !== emp.Nome &&
                    !other.shifts[day] &&
                    (parseInt(other['Ore Contratto']) || 0) > other.assignedHours &&
                    !other.parsedPrefs.blockedDays.has(day)
                );
                if (otherStaffAvailable && countOpen >= 1 && countClose >= 1) continue;
            }

            // --- CHECK DAY OVERRIDES ---
            // If the employee has a specific preference for TODAY, it replaces their general preference.
            const dayPref = emp.parsedPrefs.dayOverrides[day] || emp.parsedPrefs;

            const remaining = contract - emp.assignedHours;
            let selectedShift = '';
            let hoursToAdd = 0;

            // --- PRIORITY 1: CRITICAL COVERAGE (Store Needs) ---
            if (!selectedShift && !dayPref.midDayOnly && !dayPref.splitShift) {
                const MIN_COVERAGE = 2;

                // Force Open
                if (countOpen < MIN_COVERAGE && !dayPref.afternoonOnly && remaining >= halfShiftDuration) {
                    selectedShift = SHIFT_MORN_DYNAMIC;
                    hoursToAdd = halfShiftDuration;
                }
                // Force Close
                else if (countClose < MIN_COVERAGE && !dayPref.morningOnly && remaining >= halfShiftDuration) {
                    selectedShift = SHIFT_AFT_DYNAMIC;
                    hoursToAdd = halfShiftDuration;
                }
            }

            // --- PRIORITY 2: EXPLICIT PREFERENCES (Employee Constraints) ---
            if (!selectedShift) {
                // Explicit Split Shift
                if (dayPref.splitShift && remaining >= 8) {
                    selectedShift = SHIFT_SPLIT_DYNAMIC;
                    hoursToAdd = 8;
                }
                // Explicit Mid-Day
                else if (dayPref.midDayOnly && remaining >= halfShiftDuration) {
                    selectedShift = SHIFT_MID_DYNAMIC;
                    hoursToAdd = halfShiftDuration;
                }
                // Morning Only
                else if (dayPref.morningOnly && remaining >= halfShiftDuration) {
                    selectedShift = SHIFT_MORN_DYNAMIC;
                    hoursToAdd = halfShiftDuration;
                }
                // Afternoon Only
                else if (dayPref.afternoonOnly && remaining >= halfShiftDuration) {
                    selectedShift = SHIFT_AFT_DYNAMIC;
                    hoursToAdd = halfShiftDuration;
                }
            }

            // --- PRIORITY 3: HISTORY OPTIMIZATION (Soft) ---
            if (!selectedShift) {
                const dayPreferred = emp.historyAnalysis.preferredByDay[day];
                const commonPreferred = emp.historyAnalysis.mostCommonShift;
                const bestHistoric = dayPreferred || commonPreferred;

                if (bestHistoric) {
                    try {
                        // VALIDATE HISTORY vs PREFERENCE (using day-specific pref)
                        const [s, e] = bestHistoric.replace(/ /g, '').split('-');
                        const startH = parseInt(s.split(':')[0]);

                        let isValidHistory = true;
                        if (dayPref.morningOnly && startH >= midPoint) isValidHistory = false;
                        if (dayPref.afternoonOnly && startH < midPoint) isValidHistory = false;
                        if (dayPref.splitShift && !bestHistoric.includes('/')) isValidHistory = false;

                        if (isValidHistory) {
                            // Calculate duration
                            let duration = 0;
                            if (bestHistoric.includes('/')) {
                                bestHistoric.split('/').forEach(seg => {
                                    const [ss, ee] = seg.replace(/ /g, '').split('-');
                                    duration += (parseInt(ee) - parseInt(ss));
                                });
                            } else {
                                duration = (parseInt(e) - parseInt(s));
                            }

                            if (duration <= remaining) {
                                selectedShift = bestHistoric;
                                hoursToAdd = duration;
                            }
                        }
                    } catch (err) { }
                }
            }

            // 5. Balance & Coverage (Fallback)
            if (!selectedShift) {
                const needMorning = countMorning <= countAfternoon;

                if (dayPref.morningOnly && remaining >= halfShiftDuration) {
                    selectedShift = SHIFT_MORN_DYNAMIC;
                    hoursToAdd = halfShiftDuration;
                } else if (dayPref.afternoonOnly && remaining >= halfShiftDuration) {
                    selectedShift = SHIFT_AFT_DYNAMIC;
                    hoursToAdd = halfShiftDuration;
                } else {
                    // No preference, try full day then half
                    if (canDoFullDay && remaining >= totalStoreHours && !dayPref.morningOnly && !dayPref.afternoonOnly) {
                        selectedShift = SHIFT_FULL_DYNAMIC;
                        hoursToAdd = totalStoreHours;
                    } else if (remaining >= halfShiftDuration) {
                        if (needMorning) {
                            selectedShift = SHIFT_MORN_DYNAMIC;
                            hoursToAdd = halfShiftDuration;
                        } else {
                            selectedShift = SHIFT_AFT_DYNAMIC;
                            hoursToAdd = halfShiftDuration;
                        }
                    }
                }
            }

            if (selectedShift) {
                // Validate hours
                try {
                    // Handle Split Shift Parsing for Duration Calculation
                    if (selectedShift.includes('/')) {
                        const segments = selectedShift.split('/').map(s => s.trim());
                        hoursToAdd = 0;
                        segments.forEach(seg => {
                            const [s, e] = seg.replace(/ /g, '').split('-');
                            hoursToAdd += (parseInt(e) - parseInt(s));
                        });
                    } else {
                        const [s, e] = selectedShift.replace(/ /g, '').split('-');
                        const dur = parseInt(e) - parseInt(s);
                        if (!isNaN(dur) && dur > 0) hoursToAdd = dur;
                        else hoursToAdd = halfShiftDuration;
                    }
                } catch (e) { hoursToAdd = halfShiftDuration; }

                assignShift(emp, day, selectedShift, hoursToAdd);

                const startHour = parseInt(selectedShift.split('-')[0]);
                if (startHour < midPoint) countMorning++;
                if (isNaN(startHour) || startHour + hoursToAdd > midPoint) countAfternoon++;

                // Detailed tracking
                if (startHour === openH) countOpen++;
                if (!isNaN(startHour) && (startHour + hoursToAdd) >= closeH) countClose++;
            }
        }

        // --- PASS 2: Aggressive Fill (Maximize Hours) ---
        // Iterate again to force assignment for those still needing hours
        for (const emp of shuffledEmployees) {
            const contract = parseInt(emp['Ore Contratto']) || 0;
            if (emp.assignedHours >= contract) continue;
            if (emp.shifts[day]) continue; // Already assigned

            // Constraints checks (REPEAT)
            if (emp.parsedPrefs.blockedDays.has(day)) continue;
            if (emp.parsedPrefs.requiredDays.size > 0 && !emp.parsedPrefs.requiredDays.has(day)) continue;
            if (emp.parsedPrefs.noWeekend && isWeekend) continue;
            if (emp.parsedPrefs.weekendOnly && !isWeekend) continue;

            // Assign ANY valid shift
            const remaining = contract - emp.assignedHours;
            const dayPref = emp.parsedPrefs.dayOverrides[day] || emp.parsedPrefs;

            let selectedShift = '';
            let hoursToAdd = 0;

            if (canDoFullDay && remaining >= totalStoreHours && !dayPref.morningOnly && !dayPref.afternoonOnly) {
                selectedShift = SHIFT_FULL_DYNAMIC;
                hoursToAdd = totalStoreHours;
            } else {
                if (remaining >= halfShiftDuration) {
                    if (dayPref.morningOnly) {
                        selectedShift = SHIFT_MORN_DYNAMIC;
                    } else if (dayPref.afternoonOnly) {
                        selectedShift = SHIFT_AFT_DYNAMIC;
                    } else {
                        selectedShift = (countMorning <= countAfternoon) ? SHIFT_MORN_DYNAMIC : SHIFT_AFT_DYNAMIC;
                    }
                    hoursToAdd = halfShiftDuration;
                } else if (remaining >= 3) {
                    // Fill gap
                    selectedShift = (countMorning <= countAfternoon) ? SHIFT_MORN_DYNAMIC : SHIFT_AFT_DYNAMIC;
                    hoursToAdd = halfShiftDuration;
                }
            }

            if (selectedShift) {
                try {
                    if (selectedShift.includes('/')) {
                        const segments = selectedShift.split('/').map(s => s.trim());
                        hoursToAdd = 0;
                        segments.forEach(seg => {
                            const [s, e] = seg.replace(/ /g, '').split('-');
                            hoursToAdd += (parseInt(e) - parseInt(s));
                        });
                    } else {
                        const [s, e] = selectedShift.replace(/ /g, '').split('-');
                        const dur = parseInt(e) - parseInt(s);
                        if (!isNaN(dur) && dur > 0) hoursToAdd = dur;
                    }
                } catch (e) { }

                assignShift(emp, day, selectedShift, hoursToAdd);
                const startHour = parseInt(selectedShift.split('-')[0]);
                if (startHour < midPoint) countMorning++;
                if (isNaN(startHour) || startHour + hoursToAdd > midPoint) countAfternoon++;
            }
        }
    }

    return schedule;
}
