const logger = require('../middleware/logger');

class TimeScheduleService {
  // Rastgele saatler oluştur (09:00 - 18:00 arası)
  generateRandomTime() {
    const hour = Math.floor(Math.random() * (18 - 9 + 1)) + 9; // 9-18 arası
    const minute = Math.floor(Math.random() * 60); // 0-59 arası

    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }

  // Hafta içi günleri al (Pazartesi-Cuma)
  getWeekdaysFromToday() {
    const days = [];
    const today = new Date();
    
    // Bugünden başlayarak sonraki 14 gün içinde hafta içi günleri bul
    for (let i = 0; i < 14; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      
      const dayOfWeek = date.getDay();
      // 0 = Pazar, 1 = Pazartesi, ..., 5 = Cuma, 6 = Cumartesi
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        days.push(new Date(date));
      }
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
      // Henüz 30 maili almayan bir gün bul
      let dayIndex = -1;
      for (let j = 0; j < weekdays.length; j++) {
        if (emailsPerDay[j] < maxPerDay) {
          dayIndex = j;
          break;
        }
      }

      if (dayIndex === -1) {
        logger.warn(`${emailCount} mail için yeterli zaman yok. ${i} mail schedule edildi.`);
        break;
      }

      const day = weekdays[dayIndex];
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
