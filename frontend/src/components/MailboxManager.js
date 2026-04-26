import React, { useState, useEffect } from 'react';
import { mailboxAPI } from '../services/api';
import './MailboxManager.css';

export default function MailboxManager() {
  const [mailboxes, setMailboxes] = useState([]);
  const [formData, setFormData] = useState({ email: '', appPassword: '' });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');

  useEffect(() => {
    loadMailboxes();
  }, []);

  const loadMailboxes = async () => {
    try {
      const response = await mailboxAPI.getAll();
      setMailboxes(response.data);
    } catch (error) {
      console.error('Mailbox\'lar yüklenirken hata:', error);
      showMessage('Mailbox\'lar yüklenemedi', 'error');
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAddMailbox = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await mailboxAPI.create(formData.email, formData.appPassword);
      showMessage('Mailbox başarıyla eklendi!', 'success');
      setFormData({ email: '', appPassword: '' });
      loadMailboxes();
    } catch (error) {
      const errorMsg = error.response?.data?.error || 'Hata oluştu';
      showMessage(errorMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMailbox = async (id) => {
    if (window.confirm('Bu mailbox\'ı silmek istediğinize emin misiniz?')) {
      try {
        await mailboxAPI.delete(id);
        showMessage('Mailbox silindi', 'success');
        loadMailboxes();
      } catch (error) {
        showMessage('Mailbox silinirken hata oluştu', 'error');
      }
    }
  };

  const showMessage = (msg, type) => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => setMessage(''), 3000);
  };

  return (
    <div className="mailbox-manager">
      <h2>Hesap Yönetimi</h2>
      <p className="page-desc">Gmail SMTP üzerinden mail göndermek için hesap ekleyin.</p>

      <div className="card">
        <div className="card-title">Yeni Gmail Hesabı Ekle</div>
        <form onSubmit={handleAddMailbox}>
          <div className="form-group">
            <label>Gmail Adresi</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              placeholder="example@gmail.com"
              required
            />
          </div>

          <div className="form-group">
            <label>Uygulama Şifresi (16 karakter)</label>
            <input
              type="password"
              name="appPassword"
              value={formData.appPassword}
              onChange={handleInputChange}
              placeholder="xxxx xxxx xxxx xxxx"
              required
            />
            <small>
              Google hesabında Güvenlik → Uygulama şifresi bölümünden alınır
            </small>
          </div>

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Ekleniyor...' : '+ Hesabı Ekle'}
          </button>
        </form>
      </div>

      {message && (
        <div className={`message ${messageType}`}>
          {message}
        </div>
      )}

      <div className="card">
        <div className="card-title">Ekli Hesaplar ({mailboxes.length})</div>
        {mailboxes.length === 0 ? (
          <p className="empty">Henüz hesap eklenmedi</p>
        ) : (
          <div className="mailboxes-list">
            <table>
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Eklenme Tarihi</th>
                  <th>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {mailboxes.map(mailbox => (
                  <tr key={mailbox.id}>
                    <td>{mailbox.email}</td>
                    <td>{new Date(mailbox.createdAt).toLocaleDateString('tr-TR')}</td>
                    <td>
                      <button
                        className="delete-btn"
                        onClick={() => handleDeleteMailbox(mailbox.id)}
                      >
                        Sil
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
