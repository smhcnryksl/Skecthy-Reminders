importScripts('storage.js', 'prayer_service.js', 'locales.js');

chrome.runtime.onInstalled.addListener(async () => {
    await checkSettingsAndSetupAlarms();
});

chrome.runtime.onStartup.addListener(async () => {
    await checkSettingsAndSetupAlarms();
});

chrome.runtime.onMessage.addListener(async (message) => {
    if (message.type === 'UPDATE_SETTINGS') {
        await checkSettingsAndSetupAlarms();
    } else if (message.type === 'SNOOZE_REMINDER') {
        chrome.alarms.create(`snooze_${message.id}`, { delayInMinutes: message.minutes });
    }
});

chrome.storage.onChanged.addListener(async (changes, namespace) => {
    if (namespace === 'local' && changes.settings) {
        await checkSettingsAndSetupAlarms();
    }
});

async function checkSettingsAndSetupAlarms() {
    const settings = await StorageService.getSettings();
    if (!settings) return;

    await handleToggleAlarm('alarm_water', settings.water, 120);

    await handleToggleAlarm('alarm_eye', settings.eye, 20);

    await handleToggleAlarm('alarm_move', settings.move, 240);

    if (settings.prayer) {
        const fetchAlarm = await chrome.alarms.get('alarm_prayer_fetch');
        if (!fetchAlarm) {
            chrome.alarms.create('alarm_prayer_fetch', { periodInMinutes: 1440 });
            await schedulePrayerAlarmsForToday();
        }
    } else {
        chrome.alarms.clear('alarm_prayer_fetch');
        const allAlarms = await chrome.alarms.getAll();
        allAlarms.forEach(a => {
            if (a.name.startsWith('prayer_instance_')) chrome.alarms.clear(a.name);
        });
    }
}


async function handleToggleAlarm(name, isEnabled, periodInMinutes) {
    const alarm = await chrome.alarms.get(name);

    if (isEnabled) {
        if (!alarm) {
            chrome.alarms.create(name, { delayInMinutes: periodInMinutes, periodInMinutes: periodInMinutes });
            const triggerTime = Date.now() + (periodInMinutes * 60000);
            console.log(`Scheduled ${name} for ${new Date(triggerTime).toLocaleTimeString()}`);
        }
    } else {
        if (alarm) {
            chrome.alarms.clear(name);
        }
    }
}

async function schedulePrayerAlarmsForToday() {
    const settings = await StorageService.getSettings();
    if (!settings || !settings.prayerLocation || !settings.prayerLocation.city) {
        console.log("Prayer alarms skipped: No location set.");
        return;
    }

    const times = await PrayerService.fetchTimes(settings.prayerLocation.city, settings.prayerLocation.country);
    console.log("Prayer times fetched:", times);
    if (!times) return;

    const prayerNames = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
    const now = new Date();

    prayerNames.forEach(pName => {
        const timeStr = times[pName];
        if (!timeStr) return;

        const [hours, minutes] = timeStr.split(':').map(Number);
        const prayerDate = new Date();
        prayerDate.setHours(hours, minutes, 0, 0);

        if (prayerDate > now) {
            const alarmName = `prayer_instance_${pName}`;
            chrome.alarms.create(alarmName, { when: prayerDate.getTime() });
        }
    });
}

function getT(key, lang = 'en') {
    if (!translations[lang]) lang = 'en';
    return translations[lang][key] || key;
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
    const settings = await StorageService.getSettings();
    const lang = settings.language || 'en';

    if (settings.silent_advanced) {
        console.log(`Silent Mode (Advanced): Suppressed alarm ${alarm.name}`);
        return;
    }

    if (settings.silent_simple) {
        if (['alarm_water', 'alarm_eye', 'alarm_move', 'alarm_prayer_fetch'].includes(alarm.name) || alarm.name.startsWith('prayer_instance_')) {
            console.log(`Silent Mode (Simple): Suppressed special alarm ${alarm.name}`);
            return;
        }
    }

    if (alarm.name === 'alarm_water') {
        showNotification(getT('notif_title_water', lang), getT('notif_msg_water', lang));
        return;
    }
    if (alarm.name === 'alarm_eye') {
        showNotification(getT('notif_title_eye', lang), getT('notif_msg_eye', lang));
        return;
    }
    if (alarm.name === 'alarm_move') {
        showNotification(getT('notif_title_move', lang), getT('notif_msg_move', lang));
        return;
    }
    if (alarm.name === 'alarm_prayer_fetch') {
        await schedulePrayerAlarmsForToday();
        return;
    }
    if (alarm.name.startsWith('prayer_instance_')) {
        const pName = alarm.name.replace('prayer_instance_', '');
        const pLoc = getT(`prayer_${pName.toLowerCase()}`, lang) || pName;
        const msg = (getT('notif_msg_prayer', lang) || "{0} prayer.").replace("{0}", pLoc);
        showNotification(getT('notif_title_prayer', lang), msg);
        return;
    }

    const reminders = await StorageService.getReminders();

    let reminderId = alarm.name;
    if (alarm.name.startsWith('snooze_')) {
        reminderId = alarm.name.replace('snooze_', '');
    }

    const reminder = reminders.find(r => r.id === reminderId);

    if (reminder) {
        if (settings.silent_simple) {
            if (['rec_daily', 'daily', 'rec_weekly', 'weekly', 'none', 'one-time'].includes(reminder.recurrence) || !reminder.recurrence) {
                console.log(`Silent Mode (Simple): Suppressed reminder ${reminder.title}`);
            } else {
                showNotification(reminder.title, reminder.description || '', reminder.id, reminder.attachedUrl);
            }
        } else {
            showNotification(reminder.title, reminder.description || '', reminder.id, reminder.attachedUrl);
        }

        if (reminder.type === 'recurring') {
            let nextTime = null;

            if (reminder.selectedDays && reminder.selectedDays.length > 0) {
                const now = new Date();
                const [hours, minutes] = reminder.baseTime.split(':').map(Number);

                for (let i = 1; i <= 7; i++) {
                    const d = new Date();
                    d.setDate(now.getDate() + i);
                    d.setHours(hours, minutes, 0, 0);

                    if (reminder.selectedDays.includes(d.getDay())) {
                        nextTime = d.getTime();
                        break;
                    }
                }
            } else {
                if (reminder.recurrence === 'daily') {
                    nextTime = reminder.alarmTime + 24 * 60 * 60 * 1000;
                } else if (reminder.recurrence === 'weekly') {
                    nextTime = reminder.alarmTime + 7 * 24 * 60 * 60 * 1000;
                } else if (reminder.recurrence === 'monthly') {
                    const next = new Date(reminder.alarmTime);
                    next.setMonth(next.getMonth() + 1);
                    nextTime = next.getTime();
                } else if (reminder.recurrence === 'yearly') {
                    const next = new Date(reminder.alarmTime);
                    next.setFullYear(next.getFullYear() + 1);
                    nextTime = next.getTime();
                }
            }

            if (nextTime) {
                reminder.alarmTime = nextTime;
                await StorageService.updateReminder(reminder);
                chrome.alarms.create(reminder.id, { when: nextTime });
            }
        }
    }
});

const NOTIFICATION_WIDTH = 400;
const NOTIFICATION_HEIGHT = 550;

function showNotification(title, message, id, url) {
    const qTitle = encodeURIComponent(title);
    const qMsg = encodeURIComponent(message || '');
    const qId = encodeURIComponent(id || '');
    const qUrl = encodeURIComponent(url || '');

    chrome.windows.create({
        url: `notification.html?title=${qTitle}&msg=${qMsg}&id=${qId}&link=${qUrl}`,
        type: 'popup',
        width: NOTIFICATION_WIDTH,
        height: NOTIFICATION_HEIGHT,
        focused: true
    });
}
