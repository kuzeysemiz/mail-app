import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:10001/api";

const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
});

// Her istekte localStorage'dan token ekle
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("authToken");
    if (token) config.headers["Authorization"] = `Bearer ${token}`;
  }
  return config;
});

// 401 gelirse token temizle — sayfa reload ile login ekranı açılır
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("authToken");
      localStorage.removeItem("authExpiry");
      window.location.reload();
    }
    return Promise.reject(err);
  }
);

export const authAPI = {
  requestCode: (deviceId: string, deviceInfo: object) =>
    api.post("/auth/request-code", { deviceId, deviceInfo }),
  verifyCode: (code: string, deviceId: string, deviceName: string) =>
    api.post("/auth/verify-code", { code, deviceId, deviceName }),
  me: () => api.get("/auth/me"),
  getSessions: () => api.get("/auth/sessions"),
  deleteSession: (id: number) => api.delete(`/auth/sessions/${id}`),
};

export const mailboxAPI = {
  create: (email: string, appPassword: string) =>
    api.post("/mailboxes/mailbox", { email, appPassword }),
  getAll: () => api.get("/mailboxes/mailboxes"),
  delete: (id: number) => api.delete(`/mailboxes/mailbox/${id}`),
};

export const emailAPI = {
  add: (mailboxId: string, recipients: string[], mailSubject: string, mailContent: string, mailSignature: string, manualDate: string | null, manualTime: string | null, weekNumber: string | null, businessHours: boolean) =>
    api.post("/emails/emails/add", { mailboxId, recipients, mailSubject, mailContent, mailSignature, manualDate, manualTime, weekNumber, businessHours }),
  checkRecipients: (emails: string[]) => api.post("/emails/check-recipients", { emails }),
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

export const leadsAPI = {
  getCompanies: (params?: { q?: string; tag?: string }) => api.get("/leads/companies", { params }),
  getTitles: (company: string) => api.get("/leads/titles", { params: { company } }),
  getLeads: (params: { company?: string; title?: string; q?: string }) =>
    api.get("/leads", { params }),
  getStats: () => api.get("/leads/stats"),
  getTags: () => api.get("/leads/tags"),
  autoTag: () => api.post("/leads/auto-tag"),
  fillCompanies: () => api.post("/leads/fill-companies"),
  getRandom: (count: number, excludeSent: boolean) =>
    api.get("/leads/random", { params: { count, excludeSent } }),
  import: () => api.post("/leads/import"),
  getApiKey: () => api.get("/leads/apikey"),
  saveApiKey: (apiKey: string) => api.post("/leads/apikey", { apiKey }),
  deleteApiKey: () => api.delete("/leads/apikey"),
};

export const deployAPI = {
  getConfig: () => api.get("/deploy/config"),
  saveToken: (token: string) => api.post("/deploy/config", { token }),
  deleteToken: () => api.delete("/deploy/config"),
  getRuns: () => api.get("/deploy/runs"),
  getRun: (runId: number) => api.get(`/deploy/runs/${runId}`),
  getJobs: (runId: number) => api.get(`/deploy/runs/${runId}/jobs`),
};

export const blacklistAPI = {
  getStats: () => api.get("/lists/stats"),
  getBlacklist: (params?: { q?: string; limit?: number; offset?: number }) =>
    api.get("/lists/blacklist", { params }),
  addBlacklist: (email: string, reason?: string) =>
    api.post("/lists/blacklist", { email, reason }),
  removeBlacklist: (id: number) => api.delete(`/lists/blacklist/${id}`),
  getWhitelist: (params?: { q?: string; limit?: number; offset?: number }) =>
    api.get("/lists/whitelist", { params }),
  removeWhitelist: (id: number) => api.delete(`/lists/whitelist/${id}`),
  getMonitoring: (params?: { q?: string; limit?: number }) =>
    api.get("/lists/monitoring", { params }),
  scanBounces: () => api.post("/lists/scan-bounces"),
};

export default api;
