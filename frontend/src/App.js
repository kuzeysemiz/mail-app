import React, { useState, useEffect } from 'react';
import './App.css';
import MailboxManager from './components/MailboxManager';
import EmailAdder from './components/EmailAdder';
import EmailManager from './components/EmailManager';
import LogViewer from './components/LogViewer';

function App() {
  const [activeTab, setActiveTab] = useState('mailbox');

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <h1>📧 Otomatik Mail Gönderme Sistemi</h1>
          <p className="subtitle">Gmail SMTP ile Zamanlı Toplu Mail Gönderimi</p>
        </div>
      </header>

      <div className="container">
        <nav className="tabs">
          <button 
            className={`tab ${activeTab === 'mailbox' ? 'active' : ''}`}
            onClick={() => setActiveTab('mailbox')}
          >
            Gmail Hesapları
          </button>
          <button 
            className={`tab ${activeTab === 'add' ? 'active' : ''}`}
            onClick={() => setActiveTab('add')}
          >
            Mail Ekle
          </button>
          <button 
            className={`tab ${activeTab === 'manage' ? 'active' : ''}`}
            onClick={() => setActiveTab('manage')}
          >
            Yönet
          </button>
          <button 
            className={`tab ${activeTab === 'logs' ? 'active' : ''}`}
            onClick={() => setActiveTab('logs')}
          >
            Loglar
          </button>
        </nav>

        <div className="content">
          {activeTab === 'mailbox' && <MailboxManager />}
          {activeTab === 'add' && <EmailAdder />}
          {activeTab === 'manage' && <EmailManager />}
          {activeTab === 'logs' && <LogViewer />}
        </div>
      </div>

      <footer className="app-footer">
        <p>© 2026 Otomatik Mail Gönderme Sistemi | Gmail SMTP API ile geliştirilmiştir</p>
      </footer>
    </div>
  );
}

export default App;
