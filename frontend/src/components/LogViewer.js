import React, { useState, useEffect } from 'react';
import { logAPI } from '../services/api';
import './LogViewer.css';

export default function LogViewer() {
  const [days, setDays] = useState([]);
  const [selectedDay, setSelectedDay] = useState('');
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadDays();
  }, []);

  const loadDays = async () => {
    try {
      const response = await logAPI.getDays();
      setDays(response.data);
      if (response.data.length > 0) {
        setSelectedDay(response.data[0]);
      }
    } catch (error) {
      console.error('Günler yüklenirken hata:', error);
    }
  };

  useEffect(() => {
    if (selectedDay) {
      loadLogsForDay(selectedDay);
    }
  }, [selectedDay]);

  const loadLogsForDay = async (day) => {
    setLoading(true);
    try {
      const response = await logAPI.getByDay(day);
      setLogs(response.data.logs);
      setStats(response.data.stats);
    } catch (error) {
      console.error('Loglar yüklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    return (
      <span className={`badge badge-${status}`}>
        {status === 'success' ? '✓ Başarılı' : '✗ Başarısız'}
      </span>
    );
  };

  return (
    <div className="log-viewer">
      <h2>Gönderim Logları</h2>

      <div className="day-selector">
        <label>Gün Seç:</label>
        <select value={selectedDay} onChange={(e) => setSelectedDay(e.target.value)}>
          {days.map(day => (
            <option key={day} value={day}>
              {new Date(day + 'T00:00:00').toLocaleDateString('tr-TR', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })} ({day})
            </option>
          ))}
        </select>
      </div>

      {stats && (
        <div className="stats-card">
          <div className="stat">
            <span className="stat-label">Toplam:</span>
            <span className="stat-value">{stats.total}</span>
          </div>
          <div className="stat success">
            <span className="stat-label">Başarılı:</span>
            <span className="stat-value">{stats.successful}</span>
          </div>
          <div className="stat failed">
            <span className="stat-label">Başarısız:</span>
            <span className="stat-value">{stats.failed}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Başarı Oranı:</span>
            <span className="stat-value">{stats.successRate}%</span>
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading">Loglar yükleniyor...</div>
      ) : logs.length === 0 ? (
        <div className="empty">Bu gün için log kaydı yok</div>
      ) : (
        <div className="logs-table">
          <table>
            <thead>
              <tr>
                <th>Alıcı Email</th>
                <th>Durum</th>
                <th>Gönderim Zamanı</th>
                <th>Hata Mesajı</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id}>
                  <td>{log.recipientEmail}</td>
                  <td>{getStatusBadge(log.status)}</td>
                  <td>{new Date(log.sentAt).toLocaleTimeString('tr-TR')}</td>
                  <td className="error-msg">
                    {log.errorMessage || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
