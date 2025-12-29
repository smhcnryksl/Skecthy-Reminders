document.addEventListener('DOMContentLoaded', async () => {
    const settings = await StorageService.getSettings();
    const lang = settings.language || 'en';

    function getT(key) {
        if (!translations[lang]) return key;
        return translations[lang][key] || key;
    }

    const params = new URLSearchParams(window.location.search);
    const title = params.get('title') || getT('default_title');
    const message = params.get('msg') || '';
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    document.getElementById('notif-title').textContent = title;
    document.getElementById('notif-time').textContent = timeStr;
    document.getElementById('snooze-btn').textContent = getT('btn_snooze');
    document.getElementById('dismiss-btn').textContent = getT('btn_dismiss');
    document.getElementById('link-btn').textContent = getT('btn_link');

    function linkify(text) {
        if (!text) return '';
        const urlRegex = /((https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9][-a-zA-Z0-9]{0,61}\.)+(com|net|org|edu|gov|io|co|uk|tr|de|info|biz|[a-z]{2})(\/[^\s]*)?)/gi;

        return text.replace(urlRegex, (url) => {
            let href = url;
            if (!/^https?:\/\//i.test(href)) {
                href = 'https://' + href;
            }
            return `<a href="${href}" target="_blank" style="color:#3498db; text-decoration:underline;">${url}</a>`;
        });
    }

    function escapeHtml(text) {
        if (!text) return '';
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    const msgEl = document.getElementById('notif-message');
    if (message && message !== 'undefined' && message !== 'null') {
        const safeMsg = escapeHtml(message);
        msgEl.innerHTML = linkify(safeMsg);
    } else {
        msgEl.style.display = 'none';
        msgEl.style.border = 'none';
    }

    const id = params.get('id');
    const link = params.get('link');
    const snoozeBtn = document.getElementById('snooze-btn');
    const linkBtn = document.getElementById('link-btn');

    if (!id) {
        snoozeBtn.style.display = 'none';
    }

    if (link && link !== 'null' && link !== '') {
        linkBtn.style.display = 'block';
        linkBtn.addEventListener('click', () => {
            chrome.tabs.query({}, (tabs) => {
                const found = tabs.find(t => t.url === link || t.url === link + '/' || t.pendingUrl === link);
                if (found) {
                    chrome.tabs.update(found.id, { active: true });
                    chrome.windows.update(found.windowId, { focused: true });
                } else {
                    chrome.tabs.create({ url: link });
                }
                window.close();
            });
        });
    }

    snoozeBtn.addEventListener('click', () => {
        if (id) {
            chrome.runtime.sendMessage({ type: 'SNOOZE_REMINDER', id: id, minutes: 10 });
        }
        window.close();
    });

    document.getElementById('dismiss-btn').addEventListener('click', () => {
        window.close();
    });

    setTimeout(() => {
        window.close();
    }, 5 * 60 * 1000);

    try {
        const audio = new Audio('notification.mp3');
        audio.play().catch(e => console.error("Audio play blocked/failed:", e));
    } catch (e) {
        console.error("Audio setup failed", e);
    }
});
