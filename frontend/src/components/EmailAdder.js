import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { mailboxAPI, emailAPI, draftAPI } from '../services/api';
import './EmailAdder.css';

export default function EmailAdder() {
  const quillRef = useRef(null);
  const [mailboxes, setMailboxes] = useState([]);
  const [selectedMailbox, setSelectedMailbox] = useState('');
  const [recipients, setRecipients] = useState('');
  const [mailSubject, setMailSubject] = useState('');
  const [mailContent, setMailContent] = useState('');
  const [mailSignature, setMailSignature] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [previewSchedule, setPreviewSchedule] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [showDraftName, setShowDraftName] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [editingDraftId, setEditingDraftId] = useState(null);

  const showMessage = (msg, type = 'success') => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => setMessage(''), 3000);
  };

  // Görsel resize helper - max 1080p, aspect ratio koru
  const resizeImage = (file, maxWidth = 1080, maxHeight = 1080) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Aspect ratio koru
          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          
          resolve(canvas.toDataURL('image/jpeg', 0.85)); // 85% quality
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleImageUpload = useCallback(async () => {
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'image/*');
    input.click();

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      if (file.size > 10 * 1024 * 1024) {
        showMessage('Görsel 10MB\'dan küçük olmalıdır', 'error');
        return;
      }

      try {
        // Görsel resize et (max 1080p)
        const resizedDataUrl = await resizeImage(file, 1080, 1080);
        
        const editor = quillRef.current?.getEditor?.();
        if (!editor) return;

        const range = editor.getSelection();
        if (range) {
          editor.insertEmbed(range.index, 'image', resizedDataUrl);
          editor.setSelection(range.index + 1);
          showMessage('Görsel başarıyla eklendi! (Boyutlandırmak için üzerine sağ tıkla)', 'success');
        }
      } catch (err) {
        console.error('Görsel işleme hatası:', err);
        showMessage('Görsel işlenirken hata oluştu', 'error');
      }
    };
  }, []);

  const modules = useMemo(() => ({
    toolbar: {
      container: [
        [{ 'header': [1, 2, 3, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        ['blockquote', 'code-block'],
        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
        [{ 'color': [] }, { 'background': [] }],
        ['link', 'image'],
        ['clean']
      ],
      handlers: {
        image: handleImageUpload
      }
    },
    keyboard: {
      bindings: {
        tab: false  // Tab keybinding'ini devre dış bırak
      }
    }
  }), [handleImageUpload]);

  const formats = [
    'header', 'bold', 'italic', 'underline', 'strike',
    'blockquote', 'code-block', 'list', 'bullet',
    'color', 'background', 'link', 'image'
  ];

  // Görselleri seçilebilir yap - useEffect ile post-render
  useEffect(() => {
    // Timeout ile Quill render'ı bittikten sonra çalış
    const timer = setTimeout(() => {
      const images = document.querySelectorAll('.ql-editor img');
      
      images.forEach((img) => {
        if (img.dataset.resizeable === 'true') return;
        
        img.dataset.resizeable = 'true';
        
        // Click handler - toggle selection ve sürükle ile resize
        img.addEventListener('click', (e) => {
          e.preventDefault();
          
          // Remove selection from other images
          document.querySelectorAll('.ql-editor img.selected').forEach(i => {
            i.classList.remove('selected');
          });
          
          // Toggle selection on this image
          if (!img.classList.contains('selected')) {
            img.classList.add('selected');
            showMessage('Resmi yeniden boyutlandırmak için sağ aşağı köşesinden sürükleyin', 'info');
          } else {
            img.classList.remove('selected');
          }
        });

        // Double click - show info
        img.addEventListener('dblclick', () => {
          const width = img.offsetWidth;
          const height = img.offsetHeight;
          showMessage(`Görsel boyutu: ${width}x${height}px`, 'info');
        });

        // Mouse down for drag resize (only if selected)
        img.addEventListener('mousedown', (e) => {
          if (!img.classList.contains('selected')) return;
          
          // Check if mouse is on bottom-right corner area (20px)
          const rect = img.getBoundingClientRect();
          const isNearCorner = (e.clientX > rect.right - 20) && (e.clientY > rect.bottom - 20);
          
          if (!isNearCorner) return;
          
          e.preventDefault();
          const startX = e.clientX;
          const startWidth = img.offsetWidth;
          const originalSrc = img.getAttribute('src'); // Orijinal Base64'ü sakla

          const onMouseMove = (moveEvent) => {
            const deltaX = moveEvent.clientX - startX;
            const newWidth = Math.max(100, startWidth + deltaX);
            img.style.width = newWidth + 'px';
            img.style.height = 'auto';
          };

          const onMouseUp = async () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            
            // Resize tamamlandı - resimi Canvas'a çizerek yeniden encode et
            const finalWidth = img.offsetWidth;
            const finalHeight = img.offsetHeight;
            
            // Yeni resim oluştur
            const tempImg = new Image();
            tempImg.onload = () => {
              const canvas = document.createElement('canvas');
              canvas.width = finalWidth;
              canvas.height = finalHeight;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(tempImg, 0, 0, finalWidth, finalHeight);
              
              // Yeni Base64'ü al
              const newDataUrl = canvas.toDataURL('image/jpeg', 0.85);
              
              // img src'yi güncelle
              img.setAttribute('src', newDataUrl);
              
              // Quill content'ini güncelle
              const editor = quillRef.current?.getEditor?.();
              if (editor) {
                const content = editor.getContents();
                // İçerikte eski resim referansını bul ve yeni ile değiştir
                content.ops?.forEach((op, idx) => {
                  if (op.insert?.image === originalSrc) {
                    op.insert.image = newDataUrl;
                  }
                });
                editor.setContents(content);
              }
              
              showMessage('Resim yeniden boyutlandırıldı ve kaydedildi', 'success');
            };
            tempImg.src = originalSrc;
          };

          document.addEventListener('mousemove', onMouseMove);
          document.addEventListener('mouseup', onMouseUp);
        });
      });
    }, 100);

    return () => clearTimeout(timer);
  }, [mailContent]);

  useEffect(() => {
    const loadMailboxes = async () => {
      try {
        const response = await mailboxAPI.getAll();
        setMailboxes(response.data);
        if (response.data.length > 0) {
          setSelectedMailbox(response.data[0].id);
        }
      } catch (error) {
        showMessage('Mailbox\'lar yüklenemedi', 'error');
      }
    };
    loadMailboxes();
  }, []);

  // Drafts'ı yükle mailbox değişince
  useEffect(() => {
    if (selectedMailbox) {
      loadDrafts();
    }
  }, [selectedMailbox]);

  const loadDrafts = async () => {
    try {
      const response = await draftAPI.getByMailbox(selectedMailbox);
      setDrafts(response.data);
    } catch (error) {
      console.error('Taslaklar yüklenemedi:', error);
    }
  };

  const handleSaveDraft = async () => {
    if (!draftName.trim()) {
      showMessage('Lütfen taslak adı girin', 'error');
      return;
    }

    if (!mailContent.trim()) {
      showMessage('Lütfen mail içeriği girin', 'error');
      return;
    }

    try {
      if (editingDraftId) {
        // Taslağı güncelle
        await draftAPI.update(editingDraftId, draftName, mailSubject, mailContent, mailSignature);
        showMessage('Taslak başarıyla güncellendi', 'success');
        setEditingDraftId(null);
      } else {
        // Yeni taslak oluştur
        await draftAPI.create(selectedMailbox, draftName, mailSubject, mailContent, mailSignature);
        showMessage('Taslak başarıyla kaydedildi', 'success');
      }
      setDraftName('');
      setShowDraftName(false);
      loadDrafts();
    } catch (error) {
      showMessage('Taslak kaydedilemedi', 'error');
    }
  };

  const handleLoadDraft = (draft) => {
    setMailSubject(draft.mailSubject);
    setMailContent(draft.mailContent);
    setMailSignature(draft.mailSignature || '');
    showMessage(`"${draft.draftName}" taslağı yüklendi`, 'success');
  };

  const handleEditDraft = (draft) => {
    setEditingDraftId(draft.id);
    setDraftName(draft.draftName);
    setMailSubject(draft.mailSubject);
    setMailContent(draft.mailContent);
    setMailSignature(draft.mailSignature || '');
    setShowDraftName(true);
    showMessage('Taslak düzenleme modu açıldı', 'info');
  };

  const handleDeleteDraft = async (draftId) => {
    if (window.confirm('Bu taslağı silmek istediğinize emin misiniz?')) {
      try {
        await draftAPI.delete(draftId);
        showMessage('Taslak başarıyla silindi', 'success');
        loadDrafts();
      } catch (error) {
        showMessage('Taslak silinemedi', 'error');
      }
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const handleAddEmails = async (e) => {
    e.preventDefault();

    if (!selectedMailbox) {
      showMessage('Lütfen bir mailbox seçin', 'error');
      return;
    }

    const emailList = recipients.split('\n').map(e => e.trim()).filter(e => e.length > 0);

    if (emailList.length === 0) {
      showMessage('Lütfen en az bir email girin', 'error');
      return;
    }

    if (emailList.length > 100) {
      showMessage('Maksimum 100 email ekleyebilirsiniz', 'error');
      return;
    }

    if (!mailContent.trim()) {
      showMessage('Lütfen mail içeriği girin', 'error');
      return;
    }

    if (!mailSubject.trim()) {
      showMessage('Lütfen mail başlığı girin', 'error');
      return;
    }

    setLoading(true);

    try {
      const response = await emailAPI.add(selectedMailbox, emailList, mailSubject, mailContent, mailSignature);
      showMessage(`${response.data.addedCount} email başarıyla eklendi!`, 'success');
      setPreviewSchedule(response.data.scheduledTimes || []);
      setRecipients('');
      setMailSubject('');
      setMailContent('');
      setMailSignature('');
    } catch (error) {
      const errorMsg = error.response?.data?.error || 'Hata oluştu';
      showMessage(errorMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="email-adder">
      <h2>Mail Listesine Ekle</h2>
      <form onSubmit={handleAddEmails} noValidate>
        <div className="form-group">
          <label>Gmail Hesabı Seç:</label>
          <select value={selectedMailbox} onChange={(e) => setSelectedMailbox(e.target.value)}>
            <option value="">-- Seç --</option>
            {mailboxes.map(mb => (<option key={mb.id} value={mb.id}>{mb.email}</option>))}
          </select>
        </div>

        <div className="form-group">
          <label>Mail Adresleri (Her satırda bir):</label>
          <textarea
            value={recipients}
            onChange={(e) => setRecipients(e.target.value)}
            placeholder="example1@gmail.com
example2@gmail.com
ex ample3@gmail.com"
            rows="6"
          />
          <small>{recipients.split('\n').filter(e => e.trim()).length} / 100</small>
        </div>

        <div className="form-group">
          <label>Mail Başlığı:</label>
          <input
            type="text"
            value={mailSubject}
            onChange={(e) => setMailSubject(e.target.value)}
            placeholder="Mail başlığını yazın..."
          />
        </div>

        <div className="form-group">
          <label>Mail İçeriği (Zengin Metin):</label>
          <ReactQuill
            ref={quillRef}
            value={mailContent}
            onChange={setMailContent}
            modules={modules}
            formats={formats}
            theme="snow"
            placeholder="Mailinizin içeriğini buraya yazın..."
            onKeyDown={(e) => {
              if (e.key === 'Tab') {
                e.preventDefault();
                // Next focusable element'e git
                const nextButton = document.querySelector('.button-group button:first-child');
                nextButton?.focus();
              }
            }}
          />
        </div>

        <div className="form-group signature-group">
          <label>İmza (Opsiyonel):</label>
          <ReactQuill
            value={mailSignature}
            onChange={setMailSignature}
            modules={modules}
            formats={formats}
            theme="snow"
            placeholder="Mail imzanızı buraya yazın..."
            onKeyDown={(e) => {
              if (e.key === 'Tab') {
                e.preventDefault();
                // Next focusable element'e git
                const nextButton = document.querySelector('.button-group button:first-child');
                nextButton?.focus();
              }
            }}
          />
        </div>

        <div className="button-group">
          <button type="submit" disabled={loading} className="submit-btn">
            {loading ? 'Ekleniyor...' : 'Mailları Ekle ve Planla'}
          </button>
          <button 
            type="button" 
            onClick={() => {
              if (editingDraftId) {
                setEditingDraftId(null);
                setDraftName('');
              }
              setShowDraftName(!showDraftName);
            }}
            className="save-draft-btn"
          >
            {showDraftName ? 'İptal' : 'Taslağı Kaydet'}
          </button>
        </div>

        {showDraftName && (
          <div className="form-group" style={{ backgroundColor: '#fff9e6', padding: '15px', borderRadius: '6px', marginTop: '10px' }}>
            <label>Taslak Adı:</label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                type="text"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                placeholder="Örn: Aylık Haber Bülteni"
                style={{ flex: 1 }}
              />
              <button
                type="button"
                onClick={handleSaveDraft}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#FFA500',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                {editingDraftId ? 'Güncelle' : 'Kaydet'}
              </button>
            </div>
          </div>
        )}
      </form>

      {message && (
        <div className={`message ${messageType}`}>
          {message}
        </div>
      )}

      {/* Taslaklar Section */}
      {drafts.length > 0 && (
        <div className="drafts-section">
          <h3>📋 Taslaklar ({drafts.length})</h3>
          <div className="drafts-list">
            {drafts.map((draft) => (
              <div key={draft.id} className="draft-item">
                <div className="draft-item-name">{draft.draftName}</div>
                <div className="draft-item-date">{formatDate(draft.updatedAt)}</div>
                <div className="draft-item-buttons">
                  <button className="draft-btn draft-btn-load" onClick={() => handleLoadDraft(draft)}>
                    Yükle
                  </button>
                  <button className="draft-btn draft-btn-edit" onClick={() => handleEditDraft(draft)}>
                    Düzenle
                  </button>
                  <button className="draft-btn draft-btn-delete" onClick={() => handleDeleteDraft(draft.id)}>
                    Sil
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {previewSchedule.length > 0 && (
        <div className="preview-schedule">
          <h3>Planlama Önizlemesi (İlk 10)</h3>
          <table>
            <thead>
              <tr><th>#</th><th>Tarih</th><th>Saat</th></tr>
            </thead>
            <tbody>
              {previewSchedule.slice(0, 10).map((schedule, i) => (<tr key={i}><td>{i + 1}</td><td>{schedule.date}</td><td>{schedule.time}</td></tr>))}
            </tbody>
          </table>
          {previewSchedule.length > 10 && (<p className="more-info">+{previewSchedule.length - 10} diğer mail daha planlandı</p>)}
        </div>
      )}
    </div>
  );
}
