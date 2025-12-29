const StorageService = {
  async getReminders() {
    const result = await chrome.storage.local.get('reminders');
    return result.reminders || [];
  },

  async addReminder(reminder) {
    const reminders = await this.getReminders();
    if (!reminder.id) reminder.id = Date.now().toString();
    if (!reminder.created) reminder.created = new Date().toISOString();

    reminders.push(reminder);
    await chrome.storage.local.set({ reminders });
    return reminder;
  },

  async updateReminder(updatedReminder) {
    const reminders = await this.getReminders();
    const index = reminders.findIndex(r => r.id === updatedReminder.id);
    if (index !== -1) {
      reminders[index] = updatedReminder;
      await chrome.storage.local.set({ reminders });
    }
  },

  async deleteReminder(id) {
    let reminders = await this.getReminders();
    reminders = reminders.filter(r => r.id !== id);
    await chrome.storage.local.set({ reminders });
  },

  async getSettings() {
    const defaultSettings = {
      water: false,
      eye: false,
      move: false,
      prayer: false,
      prayerLocation: { city: "", country: "" },
      language: 'en'
    };
    const result = await chrome.storage.local.get('settings');
    return { ...defaultSettings, ...result.settings };
  },

  async updateSettings(newSettings) {
    await chrome.storage.local.set({ settings: newSettings });
  },

  async getPrayerTimes() {
    const result = await chrome.storage.local.get('prayerTimes');
    return result.prayerTimes || null;
  },

  async setPrayerTimes(data) {
    await chrome.storage.local.set({ prayerTimes: data });
  }
};
