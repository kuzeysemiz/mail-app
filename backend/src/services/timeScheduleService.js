const logger = require('../middleware/logger');

class TimeScheduleService {
  // Rastgele saatler oluştur (09:00 - 18:00 arası)
  generateRandomTime() {
    const hour = Math.floor(Math.random() * (18 - 9)) + 9; // 9-17 arası (max 17:59)
    const minute = Math.floor(Math.random() * 60);

    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
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
        date: day.toISOString().split('T')[0],
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
