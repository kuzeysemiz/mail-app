const logger = require('../middleware/logger');

class TimeScheduleService {
  // Rastgele saatler oluştur
  generateRandomTime(businessHours = true) {
    const hourMin = businessHours ? 9 : 0;
    const hourMax = businessHours ? 18 : 24;
    const hour = Math.floor(Math.random() * (hourMax - hourMin)) + hourMin;
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

  // Sonraki 5 günü al (businessHours=true → Pzt-Cum, false → tüm günler)
  getWeekdaysFromToday(businessHours = true) {
    const days = [];
    const today = new Date();
    let i = 0;

    while (days.length < 5) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const dayOfWeek = date.getDay();
      if (!businessHours || (dayOfWeek >= 1 && dayOfWeek <= 5)) {
        days.push(date);
      }
      i++;
    }

    return days;
  }

  // Ayın belirtilen haftasındaki günleri al (businessHours=true → Pzt-Cum, false → tüm günler)
  getWeekdaysInMonthWeek(weekNumber, businessHours = true) {
    const now = new Date();
    const startDay = (weekNumber - 1) * 7 + 1;
    const endDay = weekNumber * 7;

    const tryMonth = (year, month) => {
      const days = [];
      for (let d = startDay; d <= endDay; d++) {
        const date = new Date(year, month, d);
        if (date.getMonth() !== month) break;
        const dow = date.getDay();
        if (!businessHours || (dow >= 1 && dow <= 5)) days.push(date);
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
  distributeEmailsByWeek(emailCount, weekNumber, businessHours = true) {
    const weekdays = this.getWeekdaysInMonthWeek(weekNumber, businessHours);
    if (weekdays.length === 0) {
      throw new Error(`Ayın ${weekNumber}. haftasında uygun gün bulunamadı`);
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
      scheduledEmails.push({ date: this.formatLocalDate(day), time: this.generateRandomTime(businessHours) });
      emailsPerDay[index]++;
    }

    logger.info(`${scheduledEmails.length} email ayın ${weekNumber}. haftasına dağıtıldı`);
    return scheduledEmails;
  }

  // Mailları rastgele zamanlara dağıt
  distributeEmailsRandomly(emailCount, mailboxId, businessHours = true) {
    const weekdays = this.getWeekdaysFromToday(businessHours);
    const maxPerDay = 30;

    if (weekdays.length === 0) {
      throw new Error('Uygun gün bulunamadı. Lütfen tekrar deneyin.');
    }

    const emailsPerDay = Array(weekdays.length).fill(0);
    const scheduledEmails = [];

    for (let i = 0; i < emailCount; i++) {
      const availableDays = weekdays
        .map((day, index) => ({ day, index }))
        .filter(({ index }) => emailsPerDay[index] < maxPerDay);

      if (availableDays.length === 0) {
        logger.warn(`${emailCount} mail için yeterli zaman yok. ${i} mail schedule edildi.`);
        break;
      }

      const { day, index: dayIndex } = availableDays[Math.floor(Math.random() * availableDays.length)];
      const time = this.generateRandomTime(businessHours);

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
