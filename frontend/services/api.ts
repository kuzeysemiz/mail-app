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

// 401 gelirse token temizle — auth endpoint'leri hariç (login/register zaten 401 dönebilir)
const AUTH_PATHS = ["/users/login", "/users/verify-otp", "/users/register", "/users/forgot-password", "/users/reset-password", "/auth/login", "/auth/verify-otp"];
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const url = err.config?.url || "";
    const isAuthEndpoint = AUTH_PATHS.some(p => url.includes(p));
    if (err.response?.status === 401 && !isAuthEndpoint && typeof window !== "undefined") {
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
  getRandom: (count: number, excludeSent: boolean, filters?: { company?: string; title?: string; tag?: string; q?: string }) =>
    api.get("/leads/random", { params: { count, excludeSent, ...filters } }),
  import: () => api.post("/leads/import"),
  getApiKey: () => api.get("/leads/apikey"),
  saveApiKey: (apiKey: string) => api.post("/leads/apikey", { apiKey }),
  deleteApiKey: () => api.delete("/leads/apikey"),
};

export const userAPI = {
  register: (email: string, password: string) => api.post("/users/register", { email, password }),
  login: (email: string, password: string) => api.post("/users/login", { email, password }),
  verifyOtp: (userId: number, otp: string) => api.post("/users/verify-otp", { userId, otp }),
  verifyEmail: (token: string) => api.get(`/users/verify-email?token=${token}`),
  forgotPassword: (email: string) => api.post("/users/forgot-password", { email }),
  resetPassword: (token: string, password: string) => api.post("/users/reset-password", { token, password }),
  me: () => api.get("/users/me"),
};

export const creditsAPI = {
  getBalance: () => api.get("/credits/balance"),
  getTransactions: () => api.get("/credits/transactions"),
  getPackages: () => api.get("/credits/packages"),
};

export const adminAPI = {
  getUsers: () => api.get("/admin/users"),
  getStats: () => api.get("/admin/stats"),
  toggleAdmin: (userId: number) => api.post(`/admin/users/${userId}/toggle-admin`),
  deleteUser: (userId: number) => api.delete(`/admin/users/${userId}`),
  confirmDeleteUser: (userId: number, otp: string, actionId: number) =>
    api.post(`/admin/users/${userId}/delete-confirm`, { otp, actionId }),
  updateCredits: (userId: number, amount: number, description?: string) =>
    api.post(`/admin/users/${userId}/credits`, { amount, description }),
  getPermissions: (userId: number) => api.get(`/admin/users/${userId}/permissions`),
  setPermissions: (userId: number, permissions: string[] | null) =>
    api.post(`/admin/users/${userId}/permissions`, { permissions }),
};

export const paddleAPI = {
  getConfig: () => api.get("/paddle/config"),
  saveConfig: (data: { clientToken?: string; apiKey?: string; webhookSecret?: string; environment?: string }) =>
    api.post("/paddle/config", data),
  setPackagePrice: (slug: string, paddlePriceId: string) =>
    api.post(`/paddle/packages/${slug}/price`, { paddlePriceId }),
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

export const inboxAPI = {
  getUnreadCount: () => api.get("/inbox/unread-count"),
  getMessages: (params?: { page?: number; limit?: number; unreadOnly?: boolean }) =>
    api.get("/inbox/", { params }),
  getMessage: (id: number) => api.get(`/inbox/${id}`),
  markRead: (id: number) => api.put(`/inbox/${id}/read`),
  markAllRead: () => api.put("/inbox/read-all"),
  reply: (id: number, body: string) => api.post(`/inbox/${id}/reply`, { body }),
  delete: (id: number) => api.delete(`/inbox/${id}`),
  scan: () => api.post("/inbox/scan"),
};

export const authSessionAPI = {
  logout: () => api.post("/auth/logout").catch(() => {}),
};

export const leadsSearchAPI = {
  search: (data: {
    city: string;
    districts: string[];
    categories: { id: string; query: string }[];
    options?: Record<string, unknown>;
  }) => api.post("/leads-search/search", data),
  status: (queryId: string) => api.get(`/leads-search/status/${queryId}`),
};

export default api;
