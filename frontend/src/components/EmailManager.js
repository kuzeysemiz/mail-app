import React, { useState, useEffect } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { mailboxAPI, emailAPI, settingsAPI } from '../services/api';
import './EmailManager.css';

export default function EmailManager() {
  const [mailboxes, setMailboxes] = useState([]);
  const [selectedMailbox, setSelectedMailbox] = useState('');
  const [viewMode, setViewMode] = useState('batches'); // 'batches' veya 'emails'
  const [batches, setBatches] = useState([]);
  const [emails, setEmails] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [editingBatchId, setEditingBatchId] = useState(null);
  const [editBatchData, setEditBatchData] = useState({});
  const [renamingBatchId, setRenamingBatchId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [message, setMessage] = useState('');
  const [sendOverdue, setSendOverdue] = useState(false);

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
    settingsAPI.get('send_overdue').then(r => setSendOverdue(r.data.value === 'true')).catch(() => {});
  }, []);

  const handleSendOverdueChange = async (e) => {
    const value = e.target.checked;
    setSendOverdue(value);
    try {
      await settingsAPI.set('send_overdue', String(value));
    } catch {
      showMessage('Ayar kaydedilemedi', 'error');
    }
  };

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
      if (viewMode === 'batches') {
        loadBatches(selectedMailbox);
      } else if (viewMode === 'emails' && !selectedBatch) {
        loadEmails(selectedMailbox);
      }
    }
  }, [selectedMailbox, viewMode, filter]);

  const loadBatches = async (mailboxId) => {
    setLoading(true);
    try {
      const response = await emailAPI.getBatches(mailboxId);
      setBatches(response.data);
    } catch (error) {
      console.error('Batch\'ler yüklenirken hata:', error);
      showMessage('Batch\'ler yüklenemedi', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadEmails = async (mailboxId, batchId = null) => {
    setLoading(true);
    try {
      let response;
      if (batchId) {
        response = await emailAPI.getBatchEmails(batchId);
      } else {
        response = await emailAPI.getByMailbox(mailboxId, filter);
      }
      setEmails(response.data);
    } catch (error) {
      console.error('Emailler yüklenirken hata:', error);
      showMessage('Emailler yüklenemedi', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleBatchSelect = (batch) => {
    setSelectedBatch(batch);
    setViewMode('emails');
    loadEmails(selectedMailbox, batch.batchId);
  };

  const handleBackToBatches = () => {
    setSelectedBatch(null);
    setViewMode('batches');
    loadBatches(selectedMailbox);
  };

  const handleEditBatch = (batch) => {
    setEditingBatchId(batch.batchId);
    setEditBatchData({
      mailSubject: batch.mailSubject || '',
      mailContent: '',
      mailSignature: ''
    });
  };

  const handleSaveEditBatch = async () => {
    try {
      await emailAPI.updateBatch(
        editingBatchId,
        editBatchData.mailSubject,
        editBatchData.mailContent,
        editBatchData.mailSignature
      );
      showMessage('Batch başarıyla güncellendi!');
      setEditingBatchId(null);
      loadBatches(selectedMailbox);
    } catch (error) {
      showMessage('Güncelleme hatası: ' + (error.response?.data?.error || 'Bilinmeyen hata'), 'error');
    }
  };

  const handleRenameBatch = async (batchId) => {
    if (!renameValue.trim()) return;
    try {
      await emailAPI.updateBatch(batchId, renameValue.trim(), null, null);
      setRenamingBatchId(null);
      loadBatches(selectedMailbox);
    } catch {
      showMessage('Yeniden adlandırma başarısız', 'error');
    }
  };

  const handleDownloadPDF = async (batch) => {
    try {
      const response = await emailAPI.getBatchEmails(batch.batchId);
      const items = response.data;
      const statusLabel = { sent: 'Gönderildi', pending: 'Bekleniyor', failed: 'Başarısız' };
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
        <title>${batch.mailSubject || 'Mail Listesi'}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 30px; color: #111; }
          h2 { margin-bottom: 4px; }
          .meta { color: #555; font-size: 13px; margin-bottom: 20px; }
          .stats { display: flex; gap: 20px; margin-bottom: 20px; font-size: 13px; }
          .stat { padding: 6px 14px; border-radius: 4px; font-weight: 600; }
          .s-total { background: #f3f4f6; }
          .s-sent  { background: #dcfce7; color: #166534; }
          .s-pend  { background: #fef9c3; color: #854d0e; }
          .s-fail  { background: #fee2e2; color: #991b1b; }
          table { width: 100%; border-collapse: collapse; font-size: 13px; }
          th { background: #f3f4f6; text-align: left; padding: 9px 10px; border-bottom: 2px solid #e5e7eb; }
          td { padding: 8px 10px; border-bottom: 1px solid #e5e7eb; }
          tr:nth-child(even) td { background: #f9fafb; }
          @media print { body { padding: 15px; } }
        </style>
      </head><body>
        <h2>${batch.mailSubject || 'Mail Listesi'}</h2>
        <div class="meta">Oluşturulma: ${new Date(batch.createdAt).toLocaleDateString('tr-TR')} &nbsp;|&nbsp; Liste ID: ${batch.batchId.substring(0,12)}</div>
        <div class="stats">
          <span class="stat s-total">Toplam: ${batch.totalCount}</span>
          <span class="stat s-sent">Gönderildi: ${batch.sentCount || 0}</span>
          <span class="stat s-pend">Bekleniyor: ${batch.pendingCount || 0}</span>
          <span class="stat s-fail">Başarısız: ${batch.failedCount || 0}</span>
        </div>
        <table>
          <thead><tr><th>#</th><th>Email Adresi</th><th>Tarih</th><th>Saat</th><th>Durum</th></tr></thead>
          <tbody>${items.map((e, i) => `
            <tr><td>${i + 1}</td><td>${e.recipientEmail}</td><td>${e.scheduledDate || '-'}</td><td>${e.scheduledTime || '-'}</td><td>${statusLabel[e.status] || e.status}</td></tr>
          `).join('')}</tbody>
        </table>
      </body></html>`;

      const win = window.open('', '_blank');
      win.document.write(html);
      win.document.close();
      setTimeout(() => win.print(), 300);
    } catch {
      showMessage('PDF oluşturulurken hata oluştu', 'error');
    }
  };

  const handleSendBatchNow = async (batchId, pendingCount) => {
    if (!window.confirm(`Bu listedeki ${pendingCount} email hemen gönderilsin mi?`)) return;
    try {
      const response = await emailAPI.sendBatchNow(batchId);
      showMessage(response.data.message);
      loadBatches(selectedMailbox);
    } catch (error) {
      showMessage('Gönderme hatası: ' + (error.response?.data?.error || 'Bilinmeyen hata'), 'error');
    }
  };

  const handleDeleteBatch = async (batchId) => {
    if (window.confirm('Bu batch\'i ve tüm email\'lerini silmek istediğinize emin misiniz?')) {
      try {
        await emailAPI.deleteBatch(batchId);
        showMessage('Batch başarıyla silindi');
        loadBatches(selectedMailbox);
      } catch (error) {
        showMessage('Silme hatası', 'error');
      }
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
      if (selectedBatch) {
        loadEmails(selectedMailbox, selectedBatch.batchId);
      } else {
        loadEmails(selectedMailbox);
      }
    } catch (error) {
      showMessage('Güncelleme hatası', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Bu email\'i silmek istediğinize emin misiniz?')) {
      try {
        await emailAPI.delete(id);
        showMessage('Email silindi');
        if (selectedBatch) {
          loadEmails(selectedMailbox, selectedBatch.batchId);
        } else {
          loadEmails(selectedMailbox);
        }
      } catch (error) {
        showMessage('Silme hatası', 'error');
      }
    }
  };

  const handleSendNow = async (id) => {
    try {
      await emailAPI.sendNow(id);
      showMessage('Email hemen gönderildi!');
      if (selectedBatch) {
        loadEmails(selectedMailbox, selectedBatch.batchId);
      } else {
        loadEmails(selectedMailbox);
      }
    } catch (error) {
      showMessage('Gönderme hatası', 'error');
    }
  };

  const showMessage = (msg, type = 'success') => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 3000);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const months = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
    const days = ['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'];
    const date = new Date(dateStr + 'T12:00:00');
    return `${date.getDate()} ${months[date.getMonth()]} ${days[date.getDay()]}`;
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
      <h2>{viewMode === 'batches' ? 'Mail Listeleri (Batch\'ler)' : 'Emailler'}</h2>

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

        {viewMode === 'batches' && (
          <button className="btn btn-secondary" onClick={() => setViewMode('emails')}>
            📧 Tüm Emailler
          </button>
        )}

        {viewMode === 'emails' && (
          <>
            <button className="btn btn-secondary" onClick={handleBackToBatches}>
              ⬅️ Listelere Geri Dön
            </button>
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
          </>
        )}

        {viewMode === 'emails' && (
          <label className="overdue-toggle">
            <input
              type="checkbox"
              checked={sendOverdue}
              onChange={handleSendOverdueChange}
            />
            Zamanı geçmiş mailleri gönder
          </label>
        )}
        {viewMode === 'emails' && (
          <span className="email-count">
            {emails.length} email
          </span>
        )}
        {viewMode === 'batches' && (
          <span className="email-count">
            {batches.length} liste
          </span>
        )}
      </div>

      {message && (
        <div className="message">
          {message}
        </div>
      )}

      {loading ? (
        <div className="loading">Yükleniyor...</div>
      ) : viewMode === 'batches' ? (
        // BATCH LİSTESİ GÖRÜNÜMÜ
        batches.length === 0 ? (
          <div className="empty">Liste yok</div>
        ) : (
          <div className="batches-list">
            {batches.map(batch => (
              <div key={batch.batchId} className="batch-card">
                {editingBatchId === batch.batchId ? (
                  <div className="edit-mode">
                    <div className="form-group">
                      <label>Mail Başlığı:</label>
                      <input
                        type="text"
                        value={editBatchData.mailSubject || ''}
                        onChange={(e) => setEditBatchData({
                          ...editBatchData,
                          mailSubject: e.target.value
                        })}
                      />
                    </div>

                    <div className="form-group">
                      <label>Mail İçeriği:</label>
                      <ReactQuill
                        value={editBatchData.mailContent || ''}
                        onChange={(content) => setEditBatchData({
                          ...editBatchData,
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
                        value={editBatchData.mailSignature || ''}
                        onChange={(signature) => setEditBatchData({
                          ...editBatchData,
                          mailSignature: signature
                        })}
                        modules={modules}
                        formats={formats}
                        theme="snow"
                        style={{ height: '120px', marginBottom: '40px' }}
                      />
                    </div>

                    <div className="edit-buttons">
                      <button 
                        className="save-btn"
                        onClick={handleSaveEditBatch}
                      >
                        Kaydet
                      </button>
                      <button 
                        className="cancel-btn"
                        onClick={() => setEditingBatchId(null)}
                      >
                        İptal
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="view-mode">
                    <div className="header">
                      <div className="batch-info">
                        <strong>Liste #{batch.batchId.substring(0, 8)}</strong>
                        {renamingBatchId === batch.batchId ? (
                          <div className="rename-row">
                            <input
                              className="rename-input"
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleRenameBatch(batch.batchId);
                                if (e.key === 'Escape') setRenamingBatchId(null);
                              }}
                              autoFocus
                            />
                            <button className="btn btn-primary rename-save-btn" onClick={() => handleRenameBatch(batch.batchId)}>Kaydet</button>
                            <button className="btn btn-secondary rename-save-btn" onClick={() => setRenamingBatchId(null)}>İptal</button>
                          </div>
                        ) : (
                          <div className="batch-subject-row">
                            <span className="batch-subject">{batch.mailSubject || 'Başlıksız'}</span>
                            <button
                              className="rename-icon-btn"
                              title="Yeniden adlandır"
                              onClick={() => { setRenamingBatchId(batch.batchId); setRenameValue(batch.mailSubject || ''); }}
                            >✏️</button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="stats">
                      <span className="stat">
                        <strong>Toplam:</strong> {batch.totalCount}
                      </span>
                      <span className={`stat badge-success`}>
                        <strong>Gönderilen:</strong> {batch.sentCount || 0}
                      </span>
                      <span className={`stat badge-pending`}>
                        <strong>Bekleniyor:</strong> {batch.pendingCount || 0}
                      </span>
                      <span className={`stat badge-danger`}>
                        <strong>Başarısız:</strong> {batch.failedCount || 0}
                      </span>
                    </div>

                    <div className="dates">
                      <span>📅 Oluşturma: {new Date(batch.createdAt).toLocaleDateString('tr-TR')}</span>
                      <span>📅 Son Gönderim: {batch.lastScheduledDate}</span>
                    </div>

                    <div className="batch-buttons">
                      <button 
                        className="btn btn-primary"
                        onClick={() => handleBatchSelect(batch)}
                      >
                        👁️ Detaylar
                      </button>
                      {batch.pendingCount > 0 && (
                        <button
                          className="btn btn-success"
                          onClick={() => handleSendBatchNow(batch.batchId, batch.pendingCount)}
                        >
                          ⚡ Hemen Gönder
                        </button>
                      )}
                      <button
                        className="btn btn-edit"
                        onClick={() => handleEditBatch(batch)}
                      >
                        ✏️ Düzenle
                      </button>
                      <button
                        className="btn btn-secondary"
                        onClick={() => handleDownloadPDF(batch)}
                      >
                        📄 PDF
                      </button>
                      <button
                        className="btn btn-danger"
                        onClick={() => handleDeleteBatch(batch.batchId)}
                      >
                        🗑️ Sil
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      ) : (
        // EMAIL LİSTESİ GÖRÜNÜMÜ
        emails.length === 0 ? (
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
                        <span className="date">{formatDate(email.scheduledDate)}</span>
                        <span className="time">{email.scheduledTime}</span>
                      </div>
                    </div>

                    <div className="subject">
                      <strong>Başlık:</strong> {email.mailSubject || 'Otomatik Mail'}
                    </div>

                    <div className="content">
                      <p>{email.mailContent.substring(0, 100).replace(/<[^>]*>/g, '')}...</p>
                    </div>

                    <div className="buttons">
                      <button 
                        className="btn btn-edit"
                        onClick={() => handleEdit(email)}
                      >
                        ✏️ Düzenle
                      </button>
                      <button 
                        className="btn btn-danger"
                        onClick={() => handleDelete(email.id)}
                      >
                        🗑️ Sil
                      </button>
                      {email.status === 'pending' && (
                        <button 
                          className="btn btn-success"
                          onClick={() => handleSendNow(email.id)}
                        >
                          ⚡ Hemen Gönder
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
