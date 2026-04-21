import React, { useState, useEffect } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { mailboxAPI, emailAPI } from '../services/api';
import './EmailManager.css';

export default function EmailManager() {
  const [mailboxes, setMailboxes] = useState([]);
  const [selectedMailbox, setSelectedMailbox] = useState('');
  const [emails, setEmails] = useState([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [message, setMessage] = useState('');

  const modules = {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'color': [] }, { 'background': [] }],
      ['link', 'image'],
      ['clean']
    ]
  };

  const formats = [
    'header',
    'bold', 'italic', 'underline', 'strike',
    'list', 'bullet',
    'color', 'background',
    'link', 'image'
  ];

  useEffect(() => {
    loadMailboxes();
  }, []);

  const loadMailboxes = async () => {
    try {
      const response = await mailboxAPI.getAll();
      setMailboxes(response.data);
      if (response.data.length > 0) {
        setSelectedMailbox(response.data[0].id);
      }
    } catch (error) {
      console.error('Mailbox\'lar yüklenirken hata:', error);
    }
  };

  useEffect(() => {
    if (selectedMailbox) {
      loadEmails(selectedMailbox);
    }
  }, [selectedMailbox, filter]);

  const loadEmails = async (mailboxId) => {
    setLoading(true);
    try {
      const url = filter 
        ? `${mailboxId}?status=${filter}`
        : mailboxId;
      const response = await emailAPI.getByMailbox(url, filter);
      setEmails(response.data);
    } catch (error) {
      console.error('Emailler yüklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (email) => {
    setEditingId(email.id);
    setEditData(email);
  };

  const handleSaveEdit = async () => {
    try {
      await emailAPI.update(editingId, editData);
      showMessage('Email başarıyla güncellendi!');
      setEditingId(null);
      loadEmails(selectedMailbox);
    } catch (error) {
      showMessage('Güncelleme hatası', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Bu email\'i silmek istediğinize emin misiniz?')) {
      try {
        await emailAPI.delete(id);
        showMessage('Email silindi');
        loadEmails(selectedMailbox);
      } catch (error) {
        showMessage('Silme hatası', 'error');
      }
    }
  };

  const handleSendNow = async (id) => {
    try {
      await emailAPI.sendNow(id);
      showMessage('Email hemen gönderildi!');
      loadEmails(selectedMailbox);
    } catch (error) {
      showMessage('Gönderme hatası', 'error');
    }
  };

  const showMessage = (msg, type = 'success') => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 3000);
  };

  const getStatusBadge = (status) => {
    const colors = {
      pending: 'pending',
      sent: 'success',
      failed: 'danger'
    };
    const labels = {
      pending: 'Bekleniyor',
      sent: 'Gönderildi',
      failed: 'Başarısız'
    };
    return (
      <span className={`badge badge-${colors[status]}`}>
        {labels[status]}
      </span>
    );
  };

  return (
    <div className="email-manager">
      <h2>Zamanlanmış Emailler</h2>

      <div className="controls">
        <div className="select-group">
          <label>Mailbox:</label>
          <select
            value={selectedMailbox}
            onChange={(e) => setSelectedMailbox(e.target.value)}
          >
            {mailboxes.map(mb => (
              <option key={mb.id} value={mb.id}>
                {mb.email}
              </option>
            ))}
          </select>
        </div>

        <div className="select-group">
          <label>Filtre:</label>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="">Tümü</option>
            <option value="pending">Bekleniyor</option>
            <option value="sent">Gönderildi</option>
            <option value="failed">Başarısız</option>
          </select>
        </div>

        <span className="email-count">
          {emails.length} email
        </span>
      </div>

      {message && (
        <div className="message">
          {message}
        </div>
      )}

      {loading ? (
        <div className="loading">Emailler yükleniyor...</div>
      ) : emails.length === 0 ? (
        <div className="empty">Email yok</div>
      ) : (
        <div className="emails-list">
          {emails.map(email => (
            <div key={email.id} className="email-card">
              {editingId === email.id ? (
                <div className="edit-mode">
                  <div className="form-group">
                    <label>Alıcı Email:</label>
                    <input
                      type="email"
                      value={editData.recipientEmail}
                      onChange={(e) => setEditData({
                        ...editData,
                        recipientEmail: e.target.value
                      })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Mail Başlığı:</label>
                    <input
                      type="text"
                      value={editData.mailSubject || ''}
                      onChange={(e) => setEditData({
                        ...editData,
                        mailSubject: e.target.value
                      })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Mail İçeriği:</label>
                    <ReactQuill
                      value={editData.mailContent || ''}
                      onChange={(content) => setEditData({
                        ...editData,
                        mailContent: content
                      })}
                      modules={modules}
                      formats={formats}
                      theme="snow"
                      style={{ height: '200px', marginBottom: '40px' }}
                    />
                  </div>

                  <div className="form-group">
                    <label>İmza:</label>
                    <ReactQuill
                      value={editData.mailSignature || ''}
                      onChange={(signature) => setEditData({
                        ...editData,
                        mailSignature: signature
                      })}
                      modules={modules}
                      formats={formats}
                      theme="snow"
                      style={{ height: '120px', marginBottom: '40px' }}
                    />
                  </div>

                  <div className="form-group">
                    <label>Tarih:</label>
                    <input
                      type="date"
                      value={editData.scheduledDate}
                      onChange={(e) => setEditData({
                        ...editData,
                        scheduledDate: e.target.value
                      })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Saat:</label>
                    <input
                      type="time"
                      value={editData.scheduledTime}
                      onChange={(e) => setEditData({
                        ...editData,
                        scheduledTime: e.target.value
                      })}
                    />
                  </div>

                  <div className="edit-buttons">
                    <button 
                      className="save-btn"
                      onClick={handleSaveEdit}
                    >
                      Kaydet
                    </button>
                    <button 
                      className="cancel-btn"
                      onClick={() => setEditingId(null)}
                    >
                      İptal
                    </button>
                  </div>
                </div>
              ) : (
                <div className="view-mode">
                  <div className="header">
                    <div className="recipient">
                      <strong>{email.recipientEmail}</strong>
                      {getStatusBadge(email.status)}
                    </div>
                    <div className="schedule">
                      <span className="date">{email.scheduledDate}</span>
                      <span className="time">{email.scheduledTime}</span>
                    </div>
                  </div>

                  <div className="subject">
                    <strong>Başlık:</strong> {email.mailSubject || 'Otomatik Mail'}
                  </div>

                  <div className="content">
                    <p>{email.mailContent.substring(0, 100).replace(/<[^>]*>/g, '')}...</p>
                  </div>

                  <div className="actions">
                    {email.status === 'pending' && (
                      <>
                        <button 
                          className="edit-btn"
                          onClick={() => handleEdit(email)}
                        >
                          Düzenle
                        </button>
                        <button 
                          className="send-btn"
                          onClick={() => handleSendNow(email.id)}
                        >
                          Hemen Gönder
                        </button>
                      </>
                    )}
                    <button 
                      className="delete-btn"
                      onClick={() => handleDelete(email.id)}
                    >
                      Sil
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
