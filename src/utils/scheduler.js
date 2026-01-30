
export const DAYS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

/**
 * Parses preferences string into structured constraints
 * @param {string} pref - "No weekend", "No Lun", "Solo Ven", etc.
 * @returns {Object} - structured preferences
 */
function parsePreferences(pref) {
    const p = pref.toLowerCase();
    const isWeekend = p.includes('weekend') || p.includes('sabato') || p.includes('domenica');
    const isNo = p.includes('no') || p.includes('mai');

    // Day Specific Parsing
    const blockedDays = new Set();
    const requiredDays = new Set();

    // Check for "Weekend Lungo" (Long Weekend)
    const isLongWeekend = p.includes('lungo') || p.includes('long');

    if (isLongWeekend && isWeekend) {
        if (isNo) {
            // "No Weekend Lungo" -> Block Fri, Sab, Dom
            blockedDays.add('Ven');
            blockedDays.add('Sab');
            blockedDays.add('Dom');
        } else if (p.includes('solo') || p.includes('only')) {
            // "Solo Weekend Lungo" -> Require Fri, Sab, Dom
            requiredDays.add('Ven');
            requiredDays.add('Sab');
            requiredDays.add('Dom');
        }
    }

    DAYS.forEach(day => {
        const dayLower = day.toLowerCase();
        // Check for "No Lun", "No Lunedì", etc.
        // We look for patterns like "no lun", "no lunedi"
        // Simple heuristic: if "no" is near the day name
        if (p.includes(`no ${dayLower}`) || p.includes(`no ${dayLower}edi`) || p.includes(`no ${dayLower}edì`)) {
            blockedDays.add(day);
        }

        // Check for "Solo Lun", "Solo Lunedì"
        if (p.includes(`solo ${dayLower}`) || p.includes(`solo ${dayLower}edi`)) {
            requiredDays.add(day);
        }
    });

    return {
        noWeekend: isNo && isWeekend && !isLongWeekend, // logic handled via blockedDays for long weekend
        weekendOnly: !isNo && isWeekend && !isLongWeekend && (p.includes('solo') || p.includes('only') || p.trim() === 'weekend'),
        morningOnly: p.includes('mattina') || p.includes('am'),
        afternoonOnly: p.includes('pomeriggio') || p.includes('pm'),
        midDayOnly: p.includes('intermedio') || p.includes('centrale') || p.includes('spezzato'),
        blockedDays,
        requiredDays
    };
}

/**
 * Analyze past shifts to find preferred patterns
 */
function analyzeHistory(employee) {
    const shifts = [];
    DAYS.forEach(day => {
        if (employee[day] && employee[day].includes('-')) {
            shifts.push(employee[day]);
        }
    });

    if (shifts.length === 0) return null;

    // Find most common shift
    const frequency = {};
    let maxFreq = 0;
    let mostCommon = null;

    shifts.forEach(s => {
        frequency[s] = (frequency[s] || 0) + 1;
        if (frequency[s] > maxFreq) {
            maxFreq = frequency[s];
            mostCommon = s;
        }
    });

    return mostCommon;
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

    const canDoFullDay = totalStoreHours <= 9;
    const SHIFT_FULL_DYNAMIC = `${storeSettings.openTime} - ${storeSettings.closeTime}`;
    const halfShiftDuration = Math.floor(totalStoreHours / 2);

    // Deep copy and Pre-process
    const schedule = employees.map(emp => ({
        ...emp,
        parsedPrefs: parsePreferences(emp['Esigenze/Preferenze'] || ''),
        preferredShift: analyzeHistory(emp), // Learn from history
        assignedHours: 0,
        shifts: {
            Lun: '', Mar: '', Mer: '', Gio: '', Ven: '', Sab: '', Dom: ''
        }
    }));

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
            // Priority 3: Distance from contract target (Largest gap first)
            const aRem = (parseInt(a['Ore Contratto']) || 0) - a.assignedHours;
            const bRem = (parseInt(b['Ore Contratto']) || 0) - b.assignedHours;
            return bRem - aRem;
        });

        // TRACK COVERAGE: We count how many people are on each "slot"
        let countMorning = 0;
        let countAfternoon = 0;

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

            const remaining = contract - emp.assignedHours;
            let selectedShift = '';
            let hoursToAdd = 0;

            // 1. Preferred Pattern (History) if generic prefs
            if (emp.preferredShift) {
                try {
                    const [s, e] = emp.preferredShift.replace(/ /g, '').split('-');
                    const duration = parseInt(e) - parseInt(s);
                    if (duration <= remaining) {
                        selectedShift = emp.preferredShift;
                        hoursToAdd = duration;
                    }
                } catch (err) { }
            }

            // 2. Explicit Mid-Day Preference
            if (!selectedShift && emp.parsedPrefs.midDayOnly && remaining >= halfShiftDuration) {
                selectedShift = SHIFT_MID_DYNAMIC;
                hoursToAdd = peakStart - peakEnd;
            }

            // 3. Balance & Coverage
            if (!selectedShift) {
                const needMorning = countMorning <= countAfternoon;

                if (emp.parsedPrefs.morningOnly && remaining >= halfShiftDuration) {
                    selectedShift = SHIFT_MORN_DYNAMIC;
                    hoursToAdd = halfShiftDuration;
                } else if (emp.parsedPrefs.afternoonOnly && remaining >= halfShiftDuration) {
                    selectedShift = SHIFT_AFT_DYNAMIC;
                    hoursToAdd = halfShiftDuration;
                } else {
                    // No preference, try full day then half
                    if (canDoFullDay && remaining >= totalStoreHours && !emp.parsedPrefs.morningOnly && !emp.parsedPrefs.afternoonOnly) {
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
                    const [s, e] = selectedShift.replace(/ /g, '').split('-');
                    const dur = parseInt(e) - parseInt(s);
                    if (!isNaN(dur) && dur > 0) hoursToAdd = dur;
                    else hoursToAdd = halfShiftDuration;
                } catch (e) { hoursToAdd = halfShiftDuration; }

                assignShift(emp, day, selectedShift, hoursToAdd);

                const startHour = parseInt(selectedShift.split('-')[0]);
                if (startHour < midPoint) countMorning++;
                if (isNaN(startHour) || startHour + hoursToAdd > midPoint) countAfternoon++;
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

            let selectedShift = '';
            let hoursToAdd = 0;

            if (canDoFullDay && remaining >= totalStoreHours && !emp.parsedPrefs.morningOnly && !emp.parsedPrefs.afternoonOnly) {
                selectedShift = SHIFT_FULL_DYNAMIC;
                hoursToAdd = totalStoreHours;
            } else {
                if (remaining >= halfShiftDuration) {
                    if (emp.parsedPrefs.morningOnly) {
                        selectedShift = SHIFT_MORN_DYNAMIC;
                    } else if (emp.parsedPrefs.afternoonOnly) {
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
                    const [s, e] = selectedShift.replace(/ /g, '').split('-');
                    const dur = parseInt(e) - parseInt(s);
                    if (!isNaN(dur) && dur > 0) hoursToAdd = dur;
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
