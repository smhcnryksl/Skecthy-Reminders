document.addEventListener('DOMContentLoaded', async () => {
    const viewList = document.getElementById('view-list');
    const viewAdd = document.getElementById('view-add');
    const viewSettings = document.getElementById('view-settings');
    const viewGuide = document.getElementById('view-guide');

    const btnAdd = document.getElementById('add-btn');
    const btnSettings = document.getElementById('settings-btn');
    const btnHelp = document.getElementById('help-btn');
    const btnBackFromAdd = document.getElementById('back-from-add');
    const btnBackFromSettings = document.getElementById('back-from-settings');
    const btnBackFromGuide = document.getElementById('back-from-guide');

    const addForm = document.getElementById('add-reminder-form');
    const btnImport = document.getElementById('import-btn');

    const listContainer = document.getElementById('reminder-list');
    const mainHeader = document.querySelector('.main-header');

    const sortBySelect = document.getElementById('sort-by');
    const filterSelect = document.getElementById('filter-select');
    let currentSort = 'time';
    let currentFilter = 'all';
    let editingReminderId = null;

    const modal = document.getElementById('custom-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalMessage = document.getElementById('modal-message');
    const modalBtn = document.getElementById('modal-ok-btn');

    function showModal(message, title = "Notice") {
        if (modalTitle) modalTitle.textContent = title;
        if (modalMessage) modalMessage.textContent = message;
        if (modal) modal.classList.remove('hidden');
    }

    if (modalBtn) {
        modalBtn.addEventListener('click', () => {
            modal.classList.add('hidden');
        });
    }

    let currentLang = 'en';
    const langSelects = document.querySelectorAll('.language-select');

    function getT(key) {
        return translations[currentLang][key] || key;
    }

    function updateLocalization() {
        const t = translations[currentLang];
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (t[key]) {
                if (el.getAttribute('data-i18n-html') === 'true') {
                    el.innerHTML = t[key];
                } else {
                    el.textContent = t[key];
                }
            }
        });
        document.querySelectorAll('[data-i18n-ph]').forEach(el => {
            const key = el.getAttribute('data-i18n-ph');
            if (t[key]) {
                el.placeholder = t[key];
            }
        });
        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            const key = el.getAttribute('data-i18n-title');
            if (t[key]) {
                el.title = t[key];
            }
        });
    }

    const appFooter = document.getElementById('app-footer');
    const langSelectorContainer = document.getElementById('lang-selector-container');

    function showView(view) {
        [viewList, viewAdd, viewSettings, viewGuide].forEach(v => v.classList.add('hidden'));
        view.classList.remove('hidden');

        if (view === viewList) {
            mainHeader.classList.remove('hidden');
            renderReminders();
        } else {
            mainHeader.classList.add('hidden');
        }
    }

    if (btnAdd) btnAdd.addEventListener('click', () => {
        editingReminderId = null;
        addForm.reset();
        document.querySelector('input[value="none"]').checked = true;
        if (inputUrl) {
            inputUrl.value = '';
            delete inputUrl.dataset.url;
        }
        updateFormVisibility('none');
        const now = new Date();
        const offsetMs = now.getTimezoneOffset() * 60000;
        inputDatetime.value = new Date(now.getTime() - offsetMs).toISOString().slice(0, 16);

        showView(viewAdd);
    });

    if (btnSettings) btnSettings.addEventListener('click', () => showView(viewSettings));
    if (btnHelp) btnHelp.addEventListener('click', () => showView(viewGuide));
    if (btnBackFromAdd) btnBackFromAdd.addEventListener('click', () => showView(viewList));
    if (btnBackFromSettings) btnBackFromSettings.addEventListener('click', () => showView(viewList));
    if (btnBackFromGuide) btnBackFromGuide.addEventListener('click', () => showView(viewList));

    function linkify(text) {
        if (!text) return '';
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        return text.replace(urlRegex, (url) => {
            return `<a href="${url}" target="_blank" onclick="event.stopPropagation();" style="color:#3498db; text-decoration:underline;">${url}</a>`;
        });
    }

    function getRemainingText(targetTime) {
        const diff = targetTime - Date.now();
        if (diff <= 0) return getT('text_expired');

        const d = Math.floor(diff / (1000 * 60 * 60 * 24));
        const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diff % (1000 * 60)) / 1000);

        let parts = [];
        if (d > 0) parts.push(`${d}g`);
        if (h > 0) parts.push(`${h}sa`);
        parts.push(`${m}dk`);
        parts.push(`${s}sn`);

        return parts.join(' ');
    }

    setInterval(() => {
        const countdowns = document.querySelectorAll('.reminder-countdown');
        countdowns.forEach(el => {
            const time = parseInt(el.getAttribute('data-time'), 10);
            if (!isNaN(time)) {
                el.textContent = getRemainingText(time);
            }
        });
    }, 1000);

    async function renderReminders() {
        listContainer.innerHTML = '';
        let reminders = await StorageService.getReminders();
        const alarms = await chrome.alarms.getAll();

        const snoozeMap = {};
        alarms.forEach(a => {
            if (a.name.startsWith('snooze_')) {
                const id = a.name.replace('snooze_', '');
                snoozeMap[id] = a.scheduledTime;
            }
        });

        const nowMs = Date.now();
        reminders = reminders.filter(r => {
            if (snoozeMap[r.id]) return true;
            if (r.type === 'recurring') return true;
            return r.alarmTime > nowMs;
        });

        if (currentFilter === 'today') {
            const today = new Date();
            const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
            const endOfDay = startOfDay + 86400000;

            reminders = reminders.filter(r => {
                const effectiveTime = snoozeMap[r.id] || r.alarmTime;
                return effectiveTime >= startOfDay && effectiveTime < endOfDay;
            });
        } else if (currentFilter === 'weekly') {
            const now = new Date();
            const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
            const endOfWeek = startOfDay + (7 * 86400000);

            reminders = reminders.filter(r => {
                const effectiveTime = snoozeMap[r.id] || r.alarmTime;
                return effectiveTime >= startOfDay && effectiveTime < endOfWeek;
            });
        }

        reminders.sort((a, b) => {
            const timeA = snoozeMap[a.id] || a.alarmTime;
            const timeB = snoozeMap[b.id] || b.alarmTime;

            if (currentSort === 'time') {
                return timeA - timeB;
            } else {
                return new Date(b.created).getTime() - new Date(a.created).getTime();
            }
        });

        if (reminders.length === 0) {
            listContainer.innerHTML = `<li style="text-align:center; padding: 20px;">${getT('no_reminders')}</li>`;
            return;
        }

        reminders.forEach(reminder => {
            const li = document.createElement('li');
            li.className = 'reminder-item';

            const isSnoozed = !!snoozeMap[reminder.id];
            const effectiveTime = snoozeMap[reminder.id] || reminder.alarmTime;

            let dateDisplay;
            let styleClass = '';

            const countdownText = getRemainingText(effectiveTime);

            if (isSnoozed) {
                dateDisplay = `<span style="color: #e67e22; font-weight: bold;">${getT('text_snoozed')}</span> ` +
                    new Date(effectiveTime).toLocaleTimeString(currentLang, { hour: '2-digit', minute: '2-digit' });
                styleClass = 'border: 2px solid #e67e22;';
            } else {
                if (reminder.type === 'recurring') {
                    let recText = reminder.recurrence;
                    if (recText === 'daily') recText = getT('rec_daily');
                    else if (recText === 'weekly') recText = getT('rec_weekly');
                    else if (recText === 'monthly') recText = getT('rec_monthly');
                    else if (recText === 'yearly') recText = getT('rec_yearly');

                    dateDisplay = `${getT('text_her')} ${recText}`;
                } else {
                    dateDisplay = new Date(reminder.alarmTime).toLocaleString(currentLang, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                }
            }

            if (isSnoozed) li.style.cssText = styleClass;

            const hasDescription = reminder.description && reminder.description.trim().length > 0;

            li.innerHTML = `
        <div class="reminder-info" style="width: 100%;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
             <h3 style="margin:0;">${reminder.title}</h3>
             <span class="reminder-countdown" data-time="${effectiveTime}" style="font-size:0.8rem; font-weight:bold; color:#2ecc71;">${countdownText}</span>
          </div>
          <p style="margin: 5px 0 0 0; font-size: 0.85rem; color: #666;">${dateDisplay}</p>
          
             ${hasDescription ? `
           <div class="desc-container">
              <a href="#" class="toggle-desc" style="font-size:0.75rem; text-decoration:underline; color:#3498db; display:inline-block; margin-top:4px;">${getT('text_desc_show')}</a>
              <p class="desc-text hidden" style="font-size:0.8rem; color:#555; background:#f9f9f9; padding:5px; margin-top:5px; border-radius:4px;">${linkify(reminder.description)}</p>
           </div>` : ''}

          ${reminder.attachedUrl ? `<div style="margin-top:4px;"><a href="#" class="open-link-list" data-url="${reminder.attachedUrl}" style="font-size:0.75rem; color:#8e44ad;">🔗 ${reminder.attachedTitle || getT('text_link')}</a></div>` : ''}
        </div>
        <div class="reminder-actions">
          <button class="share-btn" title="Paylaş">🔗</button>
          <button class="edit-btn" title="Düzenle">✏️</button>
          <button class="delete-btn" title="Sil">🗑️</button>
        </div>
      `;

            li.querySelector('.delete-btn').addEventListener('click', async () => {
                await StorageService.deleteReminder(reminder.id);
                chrome.alarms.clear(reminder.id);
                if (isSnoozed) chrome.alarms.clear(`snooze_${reminder.id}`);
                renderReminders();
            });

            li.querySelector('.share-btn').addEventListener('click', () => {
                const code = btoa(encodeURIComponent(JSON.stringify(reminder)));
                navigator.clipboard.writeText(code).then(() => {
                    showModal(getT('alert_copied'), getT('alert_success'));
                });
            });

            li.querySelector('.edit-btn').addEventListener('click', () => {
                editingReminderId = reminder.id;

                document.getElementById('title').value = reminder.title;
                document.getElementById('description').value = reminder.description || '';

                if (inputUrl) {
                    inputUrl.value = reminder.attachedTitle || reminder.attachedUrl || '';
                    inputUrl.dataset.url = reminder.attachedUrl || '';
                }

                const recVal = reminder.recurrence || 'none';
                const radio = document.querySelector(`input[name="recurrence"][value="${recVal}"]`);
                if (radio) radio.checked = true;
                updateFormVisibility(recVal);

                if (recVal === 'none') {
                    if (reminder.alarmTime) {
                        const d = new Date(reminder.alarmTime);
                        const offset = d.getTimezoneOffset() * 60000;
                        const iso = new Date(d.getTime() - offset).toISOString().slice(0, 16);
                        inputDatetime.value = iso;
                    }
                } else {
                    if (reminder.baseTime) {
                        inputTime.value = reminder.baseTime;
                    }
                    if (recVal === 'daily' && reminder.selectedDays) {
                        dayCheckboxes.forEach(cb => {
                            cb.checked = reminder.selectedDays.includes(parseInt(cb.value));
                        });
                    } else if (recVal === 'weekly' && reminder.selectedDays && reminder.selectedDays.length > 0) {
                        weeklyDaySelect.value = reminder.selectedDays[0];
                    } else if (recVal === 'monthly') {
                        if (reminder.alarmTime) {
                            const d = new Date(reminder.alarmTime);
                            monthlyDayInput.value = d.getDate();
                        }
                    } else if (recVal === 'yearly') {
                        if (reminder.alarmTime) {
                            const d = new Date(reminder.alarmTime);
                            yearlyMonthSelect.value = d.getMonth();
                            yearlyDayInput.value = d.getDate();
                        }
                    }
                }

                showView(viewAdd);
            });

            const toggleBtn = li.querySelector('.toggle-desc');
            if (toggleBtn) {
                toggleBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    const desc = li.querySelector('.desc-text');
                    desc.classList.toggle('hidden');
                    toggleBtn.textContent = desc.classList.contains('hidden') ? getT('text_desc_show') : getT('text_desc_hide');
                });
            }

            const linkLink = li.querySelector('.open-link-list');
            if (linkLink) {
                linkLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    const url = linkLink.dataset.url;
                    chrome.tabs.create({ url });
                });
            }

            listContainer.appendChild(li);
        });
    }

    if (sortBySelect) {
        sortBySelect.addEventListener('change', () => {
            currentSort = sortBySelect.value;
            renderReminders();
        });
    }

    if (filterSelect) {
        filterSelect.addEventListener('change', () => {
            currentFilter = filterSelect.value;
            renderReminders();
        });
    }

    const recurrenceRadios = document.querySelectorAll('input[name="recurrence"]');
    const containerDatetime = document.getElementById('container-datetime');
    const containerTime = document.getElementById('container-time');
    const containerDays = document.getElementById('container-days');
    const containerWeekly = document.getElementById('container-weekly');
    const containerMonthly = document.getElementById('container-monthly');
    const containerYearly = document.getElementById('container-yearly');
    const inputDatetime = document.getElementById('input-datetime');
    const inputTime = document.getElementById('input-time');
    const dayCheckboxes = document.querySelectorAll('#container-days input[type="checkbox"]');
    const weeklyDaySelect = document.getElementById('weekly-day-select');
    const monthlyDayInput = document.getElementById('monthly-day-input');
    const yearlyMonthSelect = document.getElementById('yearly-month-select');
    const yearlyDayInput = document.getElementById('yearly-day-input');

    const now = new Date();
    const offsetMs = now.getTimezoneOffset() * 60000;
    const localIso = new Date(now.getTime() - offsetMs).toISOString().slice(0, 16);
    if (inputDatetime) inputDatetime.value = localIso;

    recurrenceRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            updateFormVisibility(radio.value);
        });
    });

    function updateFormVisibility(val) {
        containerDatetime.classList.add('hidden');
        containerTime.classList.add('hidden');
        containerDays.classList.add('hidden');
        containerWeekly.classList.add('hidden');
        containerMonthly.classList.add('hidden');
        if (containerYearly) containerYearly.classList.add('hidden');

        if (val === 'daily') {
            containerTime.classList.remove('hidden');
            containerDays.classList.remove('hidden');
            dayCheckboxes.forEach(cb => cb.checked = true);
        } else if (val === 'weekly') {
            containerTime.classList.remove('hidden');
            containerWeekly.classList.remove('hidden');
        } else if (val === 'monthly') {
            containerTime.classList.remove('hidden');
            containerMonthly.classList.remove('hidden');
        } else if (val === 'yearly') {
            containerTime.classList.remove('hidden');
            containerYearly.classList.remove('hidden');
        } else {
            containerDatetime.classList.remove('hidden');
        }
    }

    updateFormVisibility('none');

    const monthlyWarning = document.getElementById('monthly-warning');
    const yearlyWarning = document.getElementById('yearly-warning');

    if (monthlyDayInput) {
        monthlyDayInput.addEventListener('input', () => {
            const val = parseInt(monthlyDayInput.value);
            if (!val) {
                monthlyWarning.classList.add('hidden');
                return;
            }

            let skippedMonths = [];
            if (val > 31) monthlyDayInput.value = 31;
            if (val === 29) skippedMonths.push('Feb (every 4 years)');
            else if (val === 30) skippedMonths.push('Feb');
            else if (val === 31) skippedMonths.push('Feb', 'Apr', 'Jun', 'Sep', 'Nov');

            if (skippedMonths.length > 0) {
                monthlyWarning.textContent = `Won't trigger in: ${skippedMonths.join(', ')}`;
                monthlyWarning.classList.remove('hidden');
            } else {
                monthlyWarning.classList.add('hidden');
            }
        });
    }

    const inputUrl = document.getElementById('reminder-url');
    const btnAttachUrl = document.getElementById('attach-url-btn');
    const btnClearUrl = document.getElementById('clear-url-btn');

    if (btnAttachUrl) {
        btnAttachUrl.addEventListener('click', () => {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs && tabs.length > 0) {
                    const tab = tabs[0];
                    inputUrl.value = tab.title || 'Tab Attached';
                    inputUrl.dataset.url = tab.url;
                }
            });
        });
    }

    if (btnClearUrl) {
        btnClearUrl.addEventListener('click', () => {
            inputUrl.value = '';
            delete inputUrl.dataset.url;
        });
    }

    function checkYearlyValidation() {
        if (!yearlyDayInput) return;
        const daysInMonth = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        const month = parseInt(yearlyMonthSelect.value);
        const day = parseInt(yearlyDayInput.value);

        if (!day) {
            yearlyWarning.classList.add('hidden');
            return;
        }

        const max = daysInMonth[month];
        yearlyDayInput.max = max;
        if (day > max) yearlyDayInput.value = max;

        if (month === 1 && parseInt(yearlyDayInput.value) === 29) {
            yearlyWarning.textContent = "Will only trigger on leap years (every 4 years).";
            yearlyWarning.classList.remove('hidden');
        } else {
            yearlyWarning.classList.add('hidden');
        }
    }

    if (yearlyMonthSelect) yearlyMonthSelect.addEventListener('change', checkYearlyValidation);
    if (yearlyDayInput) {
        yearlyDayInput.addEventListener('change', checkYearlyValidation);
        yearlyDayInput.addEventListener('input', checkYearlyValidation);
    }
    checkYearlyValidation();


    if (addForm) {
        addForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const title = document.getElementById('title').value;
            const recurrenceRadio = document.querySelector('input[name="recurrence"]:checked');
            const recurrence = recurrenceRadio ? recurrenceRadio.value : 'none';

            if (!title) return;

            const allReminders = await StorageService.getReminders();
            const existingDuplicate = allReminders.find(r => {
                if (editingReminderId && r.id === editingReminderId) return false;
                return r.title.toLowerCase() === title.trim().toLowerCase();
            });

            if (existingDuplicate) {
                const now = Date.now();
                const isRecurring = existingDuplicate.recurrence && existingDuplicate.recurrence !== 'none';
                const isActiveOneTime = !isRecurring && existingDuplicate.alarmTime > now;

                if (isRecurring || isActiveOneTime) {
                    showModal(getT('alert_duplicate'), getT('alert_error'));
                    return;
                } else {
                    // Expired one-time reminder: Allow overwrite (delete old one first)
                    await StorageService.deleteReminder(existingDuplicate.id);
                    chrome.alarms.clear(existingDuplicate.id);
                }
            }

            let nextTriggerTime = null;
            let selectedDays = [];
            let monthDay = null;
            let yearMonth = null;
            let yearDay = null;

            if (recurrence !== 'none') {
                if (!inputTime.value) {
                    showModal(getT('alert_validation_time'), 'Validation');
                    return;
                }

                const [tHours, tMinutes] = inputTime.value.split(':').map(Number);

                if (recurrence === 'daily') {
                    containerDays.querySelectorAll('input:checked').forEach(cb => {
                        selectedDays.push(parseInt(cb.value));
                    });
                    if (selectedDays.length === 0) {
                        showModal(getT('alert_validation_days'), 'Validation');
                        return;
                    }
                } else if (recurrence === 'weekly') {
                    selectedDays.push(parseInt(weeklyDaySelect.value));
                } else if (recurrence === 'monthly') {
                    monthDay = parseInt(monthlyDayInput.value);
                    if (!monthDay || monthDay < 1 || monthDay > 31) {
                        showModal(getT('alert_validation_day_range'), 'Validation');
                        return;
                    }
                } else if (recurrence === 'yearly') {
                    yearMonth = parseInt(yearlyMonthSelect.value);
                    yearDay = parseInt(yearlyDayInput.value);
                    if (!yearDay || yearDay < 1 || yearDay > 31) {
                        showModal(getT('alert_validation_day_range'), 'Validation');
                        return;
                    }
                }

                const now = new Date();

                if (recurrence === 'monthly') {
                    let candidate = new Date();
                    candidate.setDate(monthDay);
                    candidate.setHours(tHours, tMinutes, 0, 0);
                    if (candidate <= now) {
                        candidate.setMonth(candidate.getMonth() + 1);
                    }
                    nextTriggerTime = candidate.getTime();
                } else if (recurrence === 'yearly') {
                    let candidate = new Date();
                    candidate.setMonth(yearMonth);
                    candidate.setDate(yearDay);
                    candidate.setHours(tHours, tMinutes, 0, 0);
                    if (candidate <= now) {
                        candidate.setFullYear(candidate.getFullYear() + 1);
                    }
                    nextTriggerTime = candidate.getTime();
                } else {
                    let foundTime = null;
                    for (let i = 0; i <= 7; i++) {
                        const d = new Date();
                        d.setDate(now.getDate() + i);
                        d.setHours(tHours, tMinutes, 0, 0);
                        if (i === 0 && d <= now) continue;
                        if (selectedDays.includes(d.getDay())) {
                            foundTime = d.getTime();
                            break;
                        }
                    }
                    nextTriggerTime = foundTime;
                }
            } else {
                if (!inputDatetime.value) {
                    showModal(getT('alert_validation_time'), 'Validation');
                    return;
                }
                nextTriggerTime = new Date(inputDatetime.value).getTime();
            }

            if (!nextTriggerTime) {
                showModal(getT('alert_calc_error'), getT('alert_error'));
                return;
            }

            const type = recurrence === 'none' ? 'one-time' : 'recurring';

            const newReminder = {
                id: editingReminderId || Date.now().toString(),
                title,
                description: document.getElementById('description').value,
                attachedUrl: inputUrl ? (inputUrl.dataset.url || '') : '',
                attachedTitle: inputUrl ? inputUrl.value : '',
                alarmTime: nextTriggerTime,
                type,
                recurrence,
                selectedDays: selectedDays.length > 0 ? selectedDays : null,
                baseTime: recurrence !== 'none' ? inputTime.value : null,
                created: editingReminderId ? (await StorageService.getReminders()).find(r => r.id === editingReminderId).created : new Date().toISOString()
            };

            if (editingReminderId) {
                await StorageService.updateReminder(newReminder);
                chrome.alarms.clear(editingReminderId);
                chrome.alarms.create(newReminder.id, { when: nextTriggerTime });
            } else {
                await StorageService.addReminder(newReminder);
                chrome.alarms.create(newReminder.id, { when: nextTriggerTime });
            }

            addForm.reset();
            document.querySelector('input[value="none"]').checked = true;
            updateFormVisibility('none');
            editingReminderId = null;
            const rNow = new Date();
            const rOffset = rNow.getTimezoneOffset() * 60000;
            inputDatetime.value = new Date(rNow.getTime() - rOffset).toISOString().slice(0, 16);

            showView(viewList);
        });
    }

    if (btnImport) {
        btnImport.addEventListener('click', async () => {
            const input = document.getElementById('import-code');
            const code = input.value.trim();
            if (!code) return;

            try {
                const jsonStr = decodeURIComponent(atob(code));
                const reminder = JSON.parse(jsonStr);

                document.getElementById('title').value = reminder.title || "";
                if (reminder.description) {
                    document.getElementById('description').value = reminder.description;
                } else {
                    document.getElementById('description').value = "";
                }

                if (inputUrl) {
                    if (reminder.attachedUrl) {
                        inputUrl.value = reminder.attachedTitle || reminder.attachedUrl;
                        inputUrl.dataset.url = reminder.attachedUrl;
                    } else {
                        inputUrl.value = "";
                        delete inputUrl.dataset.url;
                    }
                }

                const recVal = reminder.recurrence || 'none';
                const radio = document.querySelector(`input[name="recurrence"][value="${recVal}"]`);
                if (radio) radio.checked = true;
                updateFormVisibility(recVal);

                if (recVal === 'none') {
                    if (reminder.alarmTime) {
                        const d = new Date(reminder.alarmTime);
                        const offset = d.getTimezoneOffset() * 60000;
                        const iso = new Date(d.getTime() - offset).toISOString().slice(0, 16);
                        inputDatetime.value = iso;
                    }
                } else {
                    if (reminder.baseTime) {
                        inputTime.value = reminder.baseTime;
                    }
                    if (recVal === 'daily' && reminder.selectedDays) {
                        dayCheckboxes.forEach(cb => {
                            cb.checked = reminder.selectedDays.includes(parseInt(cb.value));
                        });
                    } else if (recVal === 'weekly' && reminder.selectedDays && reminder.selectedDays.length > 0) {
                        weeklyDaySelect.value = reminder.selectedDays[0];
                    } else if (recVal === 'monthly') {
                        if (reminder.alarmTime) {
                            const d = new Date(reminder.alarmTime);
                            monthlyDayInput.value = d.getDate();
                        }
                    } else if (recVal === 'yearly') {
                        if (reminder.alarmTime) {
                            const d = new Date(reminder.alarmTime);
                            yearlyMonthSelect.value = d.getMonth();
                            yearlyDayInput.value = d.getDate();
                        }
                    }
                }

                showModal(getT('alert_imported'), getT('alert_success'));
                input.value = '';
                showView(viewAdd);

            } catch (e) {
                showModal(getT('alert_invalid_code'), getT('alert_error'));
                console.error(e);
            }
        });
    }


    const checks = {
        water: document.getElementById('setting-water'),
        eye: document.getElementById('setting-eye'),
        move: document.getElementById('setting-move'),
        prayer: document.getElementById('setting-prayer')
    };

    const silentSimpleSwitches = document.querySelectorAll('.setting-silent-simple-switch');
    const silentAdvancedSwitches = document.querySelectorAll('.setting-silent-advanced-switch');

    const prayerConfig = document.getElementById('prayer-config');
    const inputCity = document.getElementById('prayer-city');
    const inputCountry = document.getElementById('prayer-country');
    const btnSaveLocation = document.getElementById('save-prayer-location');
    const btnChangeLocation = document.getElementById('change-prayer-location');
    const prayerLocationDisplay = document.getElementById('prayer-location-display');
    const prayerListEl = document.getElementById('prayer-times-list');

    const currentSettings = await StorageService.getSettings();

    currentLang = currentSettings.language || 'en';

    if (langSelects.length > 0) {
        langSelects.forEach(select => {
            select.value = currentLang;
            select.addEventListener('change', async (e) => {
                const newVal = e.target.value;
                currentLang = newVal;
                langSelects.forEach(s => s.value = newVal);

                currentSettings.language = currentLang;
                await StorageService.updateSettings(currentSettings);
                if (typeof updateLocalization === 'function') updateLocalization();
                if (typeof renderReminders === 'function') renderReminders();
            });
        });
    }

    if (typeof updateLocalization === 'function') updateLocalization();

    function bindSilentSwitches(nodeList, settingKey, otherNodeList, otherKey) {
        if (nodeList.length > 0) {
            nodeList.forEach(sw => {
                sw.checked = currentSettings[settingKey] || false;
                sw.addEventListener('change', async (e) => {
                    const newVal = e.target.checked;

                    nodeList.forEach(s => s.checked = newVal);
                    currentSettings[settingKey] = newVal;

                    if (newVal && otherNodeList && otherKey) {
                        otherNodeList.forEach(s => s.checked = false);
                        currentSettings[otherKey] = false;
                    }

                    await StorageService.updateSettings(currentSettings);
                });
            });
        }
    }

    bindSilentSwitches(silentSimpleSwitches, 'silent_simple', silentAdvancedSwitches, 'silent_advanced');
    bindSilentSwitches(silentAdvancedSwitches, 'silent_advanced', silentSimpleSwitches, 'silent_simple');

    for (const [key, checkbox] of Object.entries(checks)) {
        if (checkbox) {
            checkbox.checked = currentSettings[key];

            checkbox.addEventListener('change', async (e) => {
                if (key === 'prayer' && checkbox.checked) {
                    if (!currentSettings.prayerLocation || !currentSettings.prayerLocation.city) {
                        prayerConfig.classList.remove('hidden');
                        if (inputCountry) inputCountry.focus();
                    } else {
                        prayerConfig.classList.add('hidden');
                    }
                } else if (key === 'prayer' && !checkbox.checked) {
                    prayerConfig.classList.add('hidden');
                    prayerListEl.innerHTML = "";
                    document.getElementById('time-prayer').textContent = "";
                } else if (!checkbox.checked) {
                    const timerEl = document.getElementById('time-' + key);
                    if (timerEl) timerEl.textContent = "";
                }

                currentSettings[key] = checkbox.checked;
                await StorageService.updateSettings(currentSettings);

                if (key === 'prayer' && currentSettings.prayerLocation && currentSettings.prayerLocation.city && checkbox.checked) {
                    fetchAndDisplayPrayerTimes(currentSettings.prayerLocation.city, currentSettings.prayerLocation.country);
                }
            });
        }
    }

    function updatePrayerUI(settings) {
        if (settings.prayerLocation && settings.prayerLocation.city) {
            prayerLocationDisplay.textContent = `(${settings.prayerLocation.city})`;
            btnChangeLocation.classList.remove('hidden');
            prayerConfig.classList.add('hidden');
            if (settings.prayer) {
                fetchAndDisplayPrayerTimes(settings.prayerLocation.city, settings.prayerLocation.country);
            }
        } else {
            prayerLocationDisplay.textContent = "";
            btnChangeLocation.classList.add('hidden');
            if (settings.prayer) {
                prayerConfig.classList.remove('hidden');
            } else {
                prayerConfig.classList.add('hidden');
            }
        }
    }

    function fetchAndDisplayPrayerTimes(city, country) {
        prayerListEl.innerHTML = '<span style="font-size:0.75rem; color:#aaa;">Loading times...</span>';
        PrayerService.fetchTimes(city, country).then(times => {
            if (times) {
                const pNames = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
                prayerListEl.innerHTML = '';
                pNames.forEach(n => {
                    if (times[n]) {
                        const div = document.createElement('div');
                        div.className = 'prayer-time-item';
                        const localizedName = getT(`prayer_${n.toLowerCase()}`) || n;
                        div.textContent = `${localizedName}: ${times[n]}`;
                        prayerListEl.appendChild(div);
                    }
                });
            } else {
                prayerListEl.textContent = "Failed to fetch.";
            }
        });
    }

    updatePrayerUI(currentSettings);

    if (btnChangeLocation) {
        btnChangeLocation.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            prayerConfig.classList.remove('hidden');
            inputCountry.value = currentSettings.prayerLocation.country || "";
            inputCity.value = currentSettings.prayerLocation.city || "";
            inputCountry.focus();
        });
    }

    if (btnSaveLocation) {
        btnSaveLocation.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();

            const city = inputCity.value.trim();
            const country = inputCountry.value.trim();

            if (!city || !country) {
                showModal(getT('alert_missing_loc'), 'Missing Info');
                return;
            }

            currentSettings.prayerLocation = { city, country };
            currentSettings.prayer = true;
            if (checks.prayer) checks.prayer.checked = true;

            await StorageService.updateSettings(currentSettings);
            updatePrayerUI(currentSettings);
        });
    }

    renderReminders();

    const timers = {
        'alarm_water': document.getElementById('time-water'),
        'alarm_eye': document.getElementById('time-eye'),
        'alarm_move': document.getElementById('time-move'),
        'alarm_prayer': document.getElementById('time-prayer')
    };

    function formatTime(ms) {
        if (ms < 0) return "00:00:00";
        const totalSec = Math.floor(ms / 1000);
        const h = Math.floor(totalSec / 3600);
        const m = Math.floor((totalSec % 3600) / 60);
        const s = totalSec % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }

    async function updateCountdowns() {
        const alarms = await chrome.alarms.getAll();

        for (const [key, el] of Object.entries(timers)) {
            if (!el) continue;

            let alarm = null;

            if (key === 'alarm_prayer') {
                const prayerAlarms = alarms.filter(a => a.name.startsWith('prayer_instance_'));
                if (prayerAlarms.length > 0) {
                    prayerAlarms.sort((a, b) => a.scheduledTime - b.scheduledTime);
                    const now = Date.now();
                    const nextPrayer = prayerAlarms.find(a => a.scheduledTime > now);
                    if (nextPrayer) {
                        alarm = nextPrayer;
                    }
                }
            } else {
                alarm = alarms.find(a => a.name === key);
            }

            if (alarm) {
                const diff = alarm.scheduledTime - Date.now();
                if (key === 'alarm_prayer') {
                    const pName = alarm.name.replace('prayer_instance_', '');
                    el.textContent = diff > 0 ? `${pName} in ${formatTime(diff)}` : "Triggering...";
                } else {
                    el.textContent = diff > 0 ? `Next in: ${formatTime(diff)}` : "Triggering...";
                }
            } else {
                if (key === 'alarm_prayer' && checks.prayer && checks.prayer.checked && currentSettings.prayerLocation && currentSettings.prayerLocation.city) {
                    el.textContent = "";
                } else {
                    el.textContent = "";
                }
            }
        }
    }

    updateCountdowns();
    setInterval(updateCountdowns, 1000);
});
