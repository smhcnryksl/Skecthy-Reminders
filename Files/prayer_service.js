const PrayerService = {
    async fetchTimes(city, country) {
        try {
            if (!city || !country) {
                console.warn("PrayerService: City or Country missing");
                return null;
            }

            const method = 13;

            const today = new Date();
            const dateStr = today.getDate() + '-' + (today.getMonth() + 1) + '-' + today.getFullYear();

            const url = `https://api.aladhan.com/v1/timingsByCity/${dateStr}?city=${city}&country=${country}&method=${method}`;

            const response = await fetch(url);
            const data = await response.json();

            if (data.code === 200) {
                return data.data.timings;
            }
            return null;
        } catch (error) {
            console.error("PrayerService Error:", error);
            return null;
        }
    }
};
