const logger = require('../middleware/logger');

class TimeScheduleService {
  // Rastgele saatler oluştur (09:00 - 18:00 arası)
  generateRandomTime() {
    const hour = Math.floor(Math.random() * (18 - 9)) + 9; // 9-17 arası (max 17:59)
    const minute = Math.floor(Math.random() * 60);

    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }

  // Yerel tarihi YYYY-MM-DD formatında döndür (toISOString UTC döndürdüğü için kullanma)
  formatLocalDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // Sonraki 5 iş gününü al (Pazartesi-Cuma)
  getWeekdaysFromToday() {
    const days = [];
    const today = new Date();
    let i = 0;

    while (days.length < 5) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const dayOfWeek = date.getDay();
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        days.push(date);
      }
      i++;
    }

    return days;
  }

  // Ayın belirtilen haftasındaki iş günlerini al (1=1-7, 2=8-14, 3=15-21, 4=22-28)
  getWeekdaysInMonthWeek(weekNumber) {
    const now = new Date();
    const startDay = (weekNumber - 1) * 7 + 1;
    const endDay = weekNumber * 7;

    const tryMonth = (year, month) => {
      const days = [];
      for (let d = startDay; d <= endDay; d++) {
        const date = new Date(year, month, d);
        if (date.getMonth() !== month) break;
        const dow = date.getDay();
        if (dow >= 1 && dow <= 5) days.push(date);
      }
      return days;
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let days = tryMonth(now.getFullYear(), now.getMonth())
      .filter(d => d >= today);

    if (days.length === 0) {
      const nextMonth = now.getMonth() === 11 ? 0 : now.getMonth() + 1;
      const nextYear = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear();
      days = tryMonth(nextYear, nextMonth);
    }

    return days;
  }

  // Ayın haftasına göre dağıt
  distributeEmailsByWeek(emailCount, weekNumber) {
    const weekdays = this.getWeekdaysInMonthWeek(weekNumber);
    if (weekdays.length === 0) {
      throw new Error(`Ayın ${weekNumber}. haftasında uygun iş günü bulunamadı`);
    }

    const maxPerDay = 30;
    const emailsPerDay = Array(weekdays.length).fill(0);
    const scheduledEmails = [];

    for (let i = 0; i < emailCount; i++) {
      const available = weekdays
        .map((day, index) => ({ day, index }))
        .filter(({ index }) => emailsPerDay[index] < maxPerDay);

      if (available.length === 0) break;

      const { day, index } = available[Math.floor(Math.random() * available.length)];
      scheduledEmails.push({ date: this.formatLocalDate(day), time: this.generateRandomTime() });
      emailsPerDay[index]++;
    }

    logger.info(`${scheduledEmails.length} email ayın ${weekNumber}. haftasına dağıtıldı`);
    return scheduledEmails;
  }

  // Mailları rastgele zamanlara dağıt
  distributeEmailsRandomly(emailCount, mailboxId) {
    const weekdays = this.getWeekdaysFromToday();
    const maxPerDay = 30;
    
    if (weekdays.length === 0) {
      throw new Error('Hafta içi gün yok. Lütfen perşembe veya daha erken bir gün tekrar deneyin.');
    }

    // Her gün için zamanlanan mailları takip et
    const emailsPerDay = Array(weekdays.length).fill(0);
    const scheduledEmails = [];

    for (let i = 0; i < emailCount; i++) {
      // Limiti dolmamış tüm günleri bul ve rastgele birini seç
      const availableDays = weekdays
        .map((day, index) => ({ day, index }))
        .filter(({ index }) => emailsPerDay[index] < maxPerDay);

      if (availableDays.length === 0) {
        logger.warn(`${emailCount} mail için yeterli zaman yok. ${i} mail schedule edildi.`);
        break;
      }

      const { day, index: dayIndex } = availableDays[Math.floor(Math.random() * availableDays.length)];
      const time = this.generateRandomTime();
      
      scheduledEmails.push({
        date: this.formatLocalDate(day),
        time: time,
        dayIndex: dayIndex
      });

      emailsPerDay[dayIndex]++;
    }

    logger.info(`${scheduledEmails.length} email rastgele olarak schedule edildi`, {
      distribution: emailsPerDay
    });

    return scheduledEmails;
  }

  // Günlük limit kontrolü
  checkDailyLimit(date, count = 1) {
    return count <= 30; // Maksimum 30 mail/gün
  }

  // Hafta içi kontrolü
  isWeekday(date) {
    const day = date.getDay();
    return day >= 1 && day <= 5; // Pazartesi-Cuma
  }
}

module.exports = new TimeScheduleService();
