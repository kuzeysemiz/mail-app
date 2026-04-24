import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Mailbox API'leri
export const mailboxAPI = {
  create: (email, appPassword) => 
    api.post('/mailboxes/mailbox', { email, appPassword }),
  getAll: () => 
    api.get('/mailboxes/mailboxes'),
  delete: (id) => 
    api.delete(`/mailboxes/mailbox/${id}`)
};

// Email API'leri
export const emailAPI = {
  add: (mailboxId, recipients, mailSubject, mailContent, mailSignature) =>
    api.post('/emails/emails/add', { mailboxId, recipients, mailSubject, mailContent, mailSignature }),
  getByMailbox: (mailboxId, status) => {
    const params = status ? `?status=${status}` : '';
    return api.get(`/emails/emails/${mailboxId}${params}`);
  },
  update: (id, data) =>
    api.put(`/emails/email/${id}`, data),
  delete: (id) =>
    api.delete(`/emails/email/${id}`),
  deleteBatch: (batchId) =>
    api.delete(`/emails/batch/${batchId}`),
  sendNow: (id) =>
    api.post(`/emails/email/${id}/send-now`),
  // Batch işlemleri
  getBatches: (mailboxId) =>
    api.get(`/emails/batches/${mailboxId}`),
  getBatchEmails: (batchId) =>
    api.get(`/emails/batch/${batchId}/emails`),
  updateBatch: (batchId, mailSubject, mailContent, mailSignature) =>
    api.put(`/emails/batch/${batchId}`, { mailSubject, mailContent, mailSignature })
};

// Log API'leri
export const logAPI = {
  getDays: () =>
    api.get('/logs/days'),
  getByDay: (day, mailboxId) => {
    const params = mailboxId ? `?mailboxId=${mailboxId}` : '';
    return api.get(`/logs/day/${day}${params}`);
  },
  getByMailbox: (mailboxId, days) => {
    const params = days ? `?days=${days}` : '';
    return api.get(`/logs/mailbox/${mailboxId}${params}`);
  },
  getEmailHistory: (emailId) =>
    api.get(`/logs/email/${emailId}`),
  getSummary: () =>
    api.get('/logs/stats/summary')
};

// Draft API'leri
export const draftAPI = {
  getByMailbox: (mailboxId) =>
    api.get(`/drafts/${mailboxId}`),
  create: (mailboxId, draftName, mailSubject, mailContent, mailSignature) =>
    api.post('/drafts', { mailboxId, draftName, mailSubject, mailContent, mailSignature }),
  update: (draftId, draftName, mailSubject, mailContent, mailSignature) =>
    api.put(`/drafts/${draftId}`, { draftName, mailSubject, mailContent, mailSignature }),
  delete: (draftId) =>
    api.delete(`/drafts/${draftId}`)
};

// Health check
export const healthCheck = () =>
  api.get('/api/health');

export default api;
