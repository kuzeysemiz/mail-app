import React, { useState } from 'react';
import './App.css';
import MailboxManager from './components/MailboxManager';
import EmailAdder from './components/EmailAdder';
import EmailManager from './components/EmailManager';
import LogViewer from './components/LogViewer';

const NAV_ITEMS = [
  { id: 'mailbox', label: 'Gmail Hesapları', icon: '📬' },
  { id: 'add',     label: 'Mail Ekle',       icon: '✉️'  },
  { id: 'manage',  label: 'Yönet',           icon: '📋'  },
  { id: 'logs',    label: 'Loglar',          icon: '📊'  },
];

const PAGE_TITLES = {
  mailbox: 'Gmail Hesapları',
  add:     'Mail Ekle',
  manage:  'Mail Listeleri',
  logs:    'Gönderim Logları',
};

export default function App() {
  const [activeTab, setActiveTab] = useState('mailbox');

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon">📧</div>
          <div className="logo-text">Mail<span>Sender</span></div>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              className={`nav-item${activeTab === item.id ? ' active' : ''}`}
              onClick={() => setActiveTab(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          © 2026 MailSender
        </div>
      </aside>

      <div className="main-content">
        <header className="page-header">
          <p className="breadcrumb">
            MailSender / <span>{PAGE_TITLES[activeTab]}</span>
          </p>
        </header>

        <div className="content">
          {activeTab === 'mailbox' && <MailboxManager />}
          {activeTab === 'add'     && <EmailAdder />}
          {activeTab === 'manage'  && <EmailManager />}
          {activeTab === 'logs'    && <LogViewer />}
        </div>
      </div>
    </div>
  );
}
