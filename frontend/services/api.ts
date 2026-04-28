import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:10001/api";

const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
});

export const mailboxAPI = {
  create: (email: string, appPassword: string) =>
    api.post("/mailboxes/mailbox", { email, appPassword }),
  getAll: () => api.get("/mailboxes/mailboxes"),
  delete: (id: number) => api.delete(`/mailboxes/mailbox/${id}`),
};

export const emailAPI = {
  add: (mailboxId: string, recipients: string[], mailSubject: string, mailContent: string, mailSignature: string, manualDate: string | null, manualTime: string | null, weekNumber: string | null, businessHours: boolean) =>
    api.post("/emails/emails/add", { mailboxId, recipients, mailSubject, mailContent, mailSignature, manualDate, manualTime, weekNumber, businessHours }),
  getByMailbox: (mailboxId: string, status?: string) => {
    const params = status ? `?status=${status}` : "";
    return api.get(`/emails/emails/${mailboxId}${params}`);
  },
  update: (id: number, data: object) => api.put(`/emails/email/${id}`, data),
  delete: (id: number) => api.delete(`/emails/email/${id}`),
  deleteBatch: (batchId: string) => api.delete(`/emails/batch/${batchId}`),
  sendNow: (id: number) => api.post(`/emails/email/${id}/send-now`),
  sendBatchNow: (batchId: string) => api.post(`/emails/batch/${batchId}/send-now`),
  getBatches: (mailboxId: string) => api.get(`/emails/batches/${mailboxId}`),
  getBatchEmails: (batchId: string) => api.get(`/emails/batch/${batchId}/emails`),
  updateBatch: (batchId: string, mailSubject: string, mailContent: string, mailSignature: string) =>
    api.put(`/emails/batch/${batchId}`, { mailSubject, mailContent, mailSignature }),
};

export const logAPI = {
  getDays: () => api.get("/logs/days"),
  getByDay: (day: string, mailboxId?: string) => {
    const params = mailboxId ? `?mailboxId=${mailboxId}` : "";
    return api.get(`/logs/day/${day}${params}`);
  },
  getSummary: () => api.get("/logs/stats/summary"),
};

export const draftAPI = {
  getByMailbox: (mailboxId: string) => api.get(`/drafts/${mailboxId}`),
  create: (mailboxId: string, draftName: string, mailSubject: string, mailContent: string, mailSignature: string) =>
    api.post("/drafts", { mailboxId, draftName, mailSubject, mailContent, mailSignature }),
  update: (draftId: number, draftName: string, mailSubject: string, mailContent: string, mailSignature: string) =>
    api.put(`/drafts/${draftId}`, { draftName, mailSubject, mailContent, mailSignature }),
  delete: (draftId: number) => api.delete(`/drafts/${draftId}`),
};

export const aiAPI = {
  enhance: (content: string, mode: string, userPrompt?: string) =>
    api.post("/ai/enhance", { content, mode, userPrompt }),
};

export const savedEmailsAPI = {
  getAll: () => api.get("/emails/saved-emails"),
};

export const settingsAPI = {
  get: (key: string) => api.get(`/settings/${key}`),
  set: (key: string, value: unknown) => api.post("/settings", { key, value }),
};

export default api;
