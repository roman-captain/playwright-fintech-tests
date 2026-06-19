import express from 'express';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import path from 'path';

const app = express();
const PORT = 3001;

app.use(express.json());
app.use(cors({ origin: true, credentials: true }));
app.use(express.static(path.join(__dirname, 'public')));

const simulatedErrors: Map<string, number> = new Map();

// Error simulation middleware – intercepts requests for test scenarios
app.use((req, res, next) => {
  for (const [endpoint, status] of simulatedErrors.entries()) {
    if (req.path.includes(endpoint) && !req.path.includes('/test/')) {
      simulatedErrors.delete(endpoint);
      return res.status(status).json({ error: `Service unavailable`, code: 'SIMULATED' });
    }
  }
  next();
});

const JWT_SECRET = 'test-secret-key';

type UserRecord = { password: string; userId: string; role: string; kyc_status: string; balance: number; spending_limit: number };

const SEED_USERS: Record<string, UserRecord> = {
  'user@test.com':        { password: 'Pass123!',  userId: 'user-abc-123',  role: 'user',  kyc_status: 'approved', balance: 1250.00, spending_limit: 5000.00 },
  'kyc-pending@test.com': { password: 'Pass123!',  userId: 'user-kyc-456',  role: 'user',  kyc_status: 'pending',  balance: 500.00,  spending_limit: 0       },
  'kyc-test@test.com':    { password: 'Pass123!',  userId: 'user-kyc-test', role: 'user',  kyc_status: 'pending',  balance: 0,       spending_limit: 0       },
  'user-b@test.com':      { password: 'Pass123!',  userId: 'user-b-789',    role: 'user',  kyc_status: 'approved', balance: 800.00,  spending_limit: 3000.00 },
  'admin@test.com':       { password: 'Admin123!', userId: 'admin-001',     role: 'admin', kyc_status: 'approved', balance: 0,       spending_limit: 0       },
};

const USERS: Record<string, UserRecord> = JSON.parse(JSON.stringify(SEED_USERS));

interface Payment {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  recipient: string;
  status: 'pending' | 'completed' | 'failed';
  idempotency_key?: string;
  created_at: string;
}

interface Notification {
  id: string;
  userId: string;
  type: 'payment_completed' | 'payment_failed' | 'kyc_approved' | 'kyc_rejected';
  message: string;
  read: boolean;
  created_at: string;
}

const notifications: Notification[] = [
  {
    id: 'notif-001',
    userId: 'user-abc-123',
    type: 'payment_completed',
    message: 'Your payment of 100.00 EUR to vendor@example.com was completed.',
    read: true,
    created_at: '2024-09-01T10:01:00Z',
  },
  {
    id: 'notif-002',
    userId: 'user-abc-123',
    type: 'kyc_approved',
    message: 'Your KYC verification has been approved. You can now make payments.',
    read: false,
    created_at: '2024-08-15T09:00:00Z',
  },
];

const SEED_PAYMENTS: Payment[] = [
  { id: 'pay-001',   userId: 'user-abc-123', amount: 100.00, currency: 'EUR', recipient: 'vendor@example.com', status: 'completed', created_at: '2024-09-01T10:00:00Z' },
  { id: 'pay-002',   userId: 'user-abc-123', amount: 250.00, currency: 'EUR', recipient: 'shop@example.com',   status: 'completed', created_at: '2024-09-05T14:30:00Z' },
  { id: 'pay-b-001', userId: 'user-b-789',   amount: 50.00,  currency: 'EUR', recipient: 'other@example.com',  status: 'completed', created_at: '2024-09-03T09:00:00Z' },
];

const payments: Payment[] = JSON.parse(JSON.stringify(SEED_PAYMENTS));

const usedIdempotencyKeys = new Set<string>();
const tokenBlacklist = new Set<string>();

function verifyToken(authHeader: string | undefined): { userId: string; role: string } | null {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  if (tokenBlacklist.has(token)) return null;
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: string; role: string };
  } catch {
    return null;
  }
}

// ─── AUTH ────────────────────────────────────────────────────────────────────

app.post('/api/v1/auth/login', (req, res) => {
  const { email, password } = req.body ?? {};

  if (!email || !password) {
    return res.status(422).json({ error: 'Missing required fields' });
  }

  const user = USERS[email as string];
  if (!user || user.password !== password) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign({ userId: user.userId, role: user.role }, JWT_SECRET, { expiresIn: '1h' });
  return res.status(200).json({ token });
});

app.post('/api/v1/auth/login-secure', (req, res) => {
  const { email, password } = req.body ?? {};

  if (!email || !password) {
    return res.status(422).json({ error: 'Missing required fields' });
  }

  const user = USERS[email as string];
  if (!user || user.password !== password) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign({ userId: user.userId, role: user.role }, JWT_SECRET, { expiresIn: '1h' });
  res.cookie('token', token, { httpOnly: true, sameSite: 'strict' });
  return res.status(200).json({ message: 'Login successful' });
});

app.post('/api/v1/auth/register', (req, res) => {
  const { email, password } = req.body ?? {};

  if (!email || !password) {
    return res.status(422).json({ error: 'Missing required fields' });
  }

  if (typeof password !== 'string' || password.length < 8) {
    return res.status(422).json({ error: 'Password must be at least 8 characters' });
  }

  if (USERS[email as string]) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  const userId = `user-${Date.now()}`;
  USERS[email as string] = {
    password,
    userId,
    role: 'user',
    kyc_status: 'pending',
    balance: 0,
    spending_limit: 0,
  };

  return res.status(201).json({ userId, email, kyc_status: 'pending' });
});

app.post('/api/v1/auth/logout', (req, res) => {
  const decoded = verifyToken(req.headers.authorization);
  if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

  const token = req.headers.authorization!.split(' ')[1];
  tokenBlacklist.add(token);

  return res.status(200).json({ message: 'Logged out successfully' });
});

app.get('/api/v1/test/expired-token', (_req, res) => {
  const token = jwt.sign(
    { userId: 'user-abc-123', role: 'user', exp: Math.floor(Date.now() / 1000) - 60 },
    JWT_SECRET
  );
  return res.status(200).json({ token });
});

// ─── PAYMENTS CORE ───────────────────────────────────────────────────────────

app.post('/api/v1/payments/initiate', (req, res) => {
  const decoded = verifyToken(req.headers.authorization);
  if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

  const userEntry = Object.values(USERS).find(u => u.userId === decoded.userId);
  if (!userEntry) return res.status(401).json({ error: 'Unauthorized' });

  if (decoded.role === 'admin') {
    return res.status(403).json({ error: 'Admins cannot initiate payments', code: 'FORBIDDEN_ROLE' });
  }

  if (userEntry.kyc_status !== 'approved') {
    return res.status(403).json({ error: 'KYC verification required', code: 'KYC_PENDING' });
  }

  const { amount, currency, recipient, idempotency_key } = req.body ?? {};

  if (!amount || !currency || !recipient || (typeof recipient === 'string' && !recipient.trim())) {
    return res.status(422).json({ error: 'Missing required fields: amount, currency, recipient' });
  }

  if (typeof amount !== 'number' || amount <= 0) {
    return res.status(422).json({ error: 'Amount must be a positive number' });
  }

  if (amount > userEntry.spending_limit) {
    return res.status(422).json({ error: 'Amount exceeds spending limit', code: 'LIMIT_EXCEEDED' });
  }

  if (amount > userEntry.balance) {
    return res.status(422).json({ error: 'Insufficient funds', code: 'INSUFFICIENT_FUNDS' });
  }

  // Idempotency: same key → same response, no duplicate
  if (idempotency_key) {
    if (usedIdempotencyKeys.has(idempotency_key as string)) {
      const existing = payments.find(p => p.idempotency_key === idempotency_key);
      if (existing) return res.status(200).json(existing);
    }
    usedIdempotencyKeys.add(idempotency_key as string);
  }

  const newPayment: Payment = {
    id: `pay-${Date.now()}`,
    userId: decoded.userId,
    amount,
    currency,
    recipient,
    status: 'pending',
    idempotency_key: idempotency_key as string | undefined,
    created_at: new Date().toISOString(),
  };

  payments.push(newPayment);
  return res.status(201).json(newPayment);
});

app.get('/api/v1/payments/:id', (req, res) => {
  const decoded = verifyToken(req.headers.authorization);
  if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

  const payment = payments.find(p => p.id === req.params.id);
  if (!payment) return res.status(404).json({ error: 'Payment not found' });

  // IDOR protection: only own resources
  if (payment.userId !== decoded.userId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  return res.status(200).json(payment);
});

app.post('/api/v1/webhooks/payment', (req, res) => {
  const { payment_id, status, signature } = req.body ?? {};

  if (!payment_id || !status) {
    return res.status(422).json({ error: 'Missing payment_id or status' });
  }

  // Signature validation (mock: accept 'valid-sig', reject anything else)
  if (!signature || signature !== 'valid-sig') {
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }

  const payment = payments.find(p => p.id === payment_id);
  if (!payment) return res.status(404).json({ error: 'Payment not found' });

  const previousStatus = payment.status;
  payment.status = status as 'pending' | 'completed' | 'failed';

  // Deduct balance + create notification when payment completes
  if (status === 'completed' && previousStatus !== 'completed') {
    const user = Object.values(USERS).find(u => u.userId === payment.userId);
    if (user) user.balance = Math.round((user.balance - payment.amount) * 100) / 100;

    notifications.push({
      id: `notif-${Date.now()}`,
      userId: payment.userId,
      type: 'payment_completed',
      message: `Your payment of ${payment.amount} ${payment.currency} to ${payment.recipient} was completed.`,
      read: false,
      created_at: new Date().toISOString(),
    });
  }

  if (status === 'failed' && previousStatus !== 'failed') {
    notifications.push({
      id: `notif-${Date.now()}`,
      userId: payment.userId,
      type: 'payment_failed',
      message: `Your payment of ${payment.amount} ${payment.currency} to ${payment.recipient} has failed.`,
      read: false,
      created_at: new Date().toISOString(),
    });
  }

  return res.status(200).json({ received: true, payment_id, status });
});

// ─── TRANSACTION HISTORY ─────────────────────────────────────────────────────

app.get('/api/v1/transactions', (req, res) => {
  const decoded = verifyToken(req.headers.authorization);
  if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

  let userTransactions = payments.filter(p => p.userId === decoded.userId);

  // Filters
  const { status, currency, from, to, limit, offset } = req.query;

  if (status) userTransactions = userTransactions.filter(p => p.status === status);
  if (currency) userTransactions = userTransactions.filter(p => p.currency === currency);
  if (from) userTransactions = userTransactions.filter(p => p.created_at >= (from as string));
  if (to) userTransactions = userTransactions.filter(p => p.created_at <= (to as string));

  const total = userTransactions.length;
  const offsetNum = parseInt(offset as string) || 0;
  const limitNum = limit !== undefined ? parseInt(limit as string) : 20;
  const paginated = limitNum === 0 ? [] : userTransactions.slice(offsetNum, offsetNum + limitNum);

  return res.status(200).json({
    data: paginated,
    total,
    limit: limitNum,
    offset: offsetNum,
  });
});

app.get('/api/v1/transactions/export', (req, res) => {
  const decoded = verifyToken(req.headers.authorization);
  if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

  const { format } = req.query;
  if (!format || !['csv', 'pdf'].includes(format as string)) {
    return res.status(422).json({ error: 'format must be csv or pdf' });
  }

  const userTransactions = payments.filter(p => p.userId === decoded.userId);

  if (format === 'csv') {
    const csv = ['id,amount,currency,recipient,status,created_at']
      .concat(userTransactions.map(t => `${t.id},${t.amount},${t.currency},${t.recipient},${t.status},${t.created_at}`))
      .join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="transactions.csv"');
    return res.status(200).send(csv);
  }

  // pdf: mock response
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="transactions.pdf"');
  return res.status(200).send('%PDF-1.4 mock');
});

app.get('/api/v1/transactions/:id', (req, res) => {
  const decoded = verifyToken(req.headers.authorization);
  if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

  const tx = payments.find(p => p.id === req.params.id);
  if (!tx) return res.status(404).json({ error: 'Transaction not found' });

  if (tx.userId !== decoded.userId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  return res.status(200).json(tx);
});

// ─── ACCOUNT SERVICE ─────────────────────────────────────────────────────────

app.get('/api/v1/account/balance', (req, res) => {
  const decoded = verifyToken(req.headers.authorization);
  if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

  const userEntry = Object.values(USERS).find(u => u.userId === decoded.userId);
  if (!userEntry) return res.status(401).json({ error: 'Unauthorized' });

  return res.status(200).json({
    userId: decoded.userId,
    balance: userEntry.balance,
    currency: 'EUR',
    spending_limit: userEntry.spending_limit,
  });
});

app.get('/api/v1/account/kyc-status', (req, res) => {
  const decoded = verifyToken(req.headers.authorization);
  if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

  const userEntry = Object.values(USERS).find(u => u.userId === decoded.userId);
  if (!userEntry) return res.status(401).json({ error: 'Unauthorized' });

  return res.status(200).json({
    userId: decoded.userId,
    kyc_status: userEntry.kyc_status,
    can_transact: userEntry.kyc_status === 'approved',
  });
});

// ─── ADMIN PANEL ─────────────────────────────────────────────────────────────

app.get('/api/v1/admin/users', (req, res) => {
  const decoded = verifyToken(req.headers.authorization);
  if (!decoded) return res.status(401).json({ error: 'Unauthorized' });
  if (decoded.role !== 'admin') return res.status(403).json({ error: 'Access denied' });

  const users = Object.entries(USERS).map(([email, u]) => ({
    userId: u.userId,
    email,
    role: u.role,
    kyc_status: u.kyc_status,
    // password intentionally excluded
  }));

  return res.status(200).json({ data: users, total: users.length });
});

app.get('/api/v1/admin/users/:userId/balance', (req, res) => {
  const decoded = verifyToken(req.headers.authorization);
  if (!decoded) return res.status(401).json({ error: 'Unauthorized' });
  if (decoded.role !== 'admin') return res.status(403).json({ error: 'Access denied' });

  const user = Object.values(USERS).find(u => u.userId === req.params.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  return res.status(200).json({
    userId: req.params.userId,
    balance: user.balance,
    currency: 'EUR',
    spending_limit: user.spending_limit,
  });
});

app.get('/api/v1/admin/kyc/queue', (req, res) => {
  const decoded = verifyToken(req.headers.authorization);
  if (!decoded) return res.status(401).json({ error: 'Unauthorized' });
  if (decoded.role !== 'admin') return res.status(403).json({ error: 'Access denied' });

  const pending = Object.entries(USERS)
    .filter(([, u]) => u.kyc_status === 'pending')
    .map(([email, u]) => ({ userId: u.userId, email, kyc_status: u.kyc_status }));

  return res.status(200).json({ data: pending, total: pending.length });
});

// ─── TEST UTILITIES (portfolio only – not in real project) ───────────────────

app.post('/api/v1/test/simulate-error', (req, res) => {
  const { endpoint, status } = req.body ?? {};
  if (!endpoint || !status) return res.status(422).json({ error: 'Missing endpoint or status' });
  simulatedErrors.set(endpoint as string, status as number);
  return res.status(200).json({ simulating: { endpoint, status } });
});

app.post('/api/v1/test/reset', (_req, res) => {
  const seed = JSON.parse(JSON.stringify(SEED_USERS));
  Object.keys(USERS).forEach(k => delete USERS[k]);
  Object.assign(USERS, seed);

  payments.length = 0;
  payments.push(...JSON.parse(JSON.stringify(SEED_PAYMENTS)));

  notifications.length = 0;
  notifications.push(
    { id: 'notif-001', userId: 'user-abc-123', type: 'payment_completed', message: 'Your payment of 100.00 EUR to vendor@example.com was completed.', read: true,  created_at: '2024-09-01T10:01:00Z' },
    { id: 'notif-002', userId: 'user-abc-123', type: 'kyc_approved',      message: 'Your KYC verification has been approved.',                       read: false, created_at: '2024-08-15T09:00:00Z' }
  );

  usedIdempotencyKeys.clear();
  tokenBlacklist.clear();

  return res.status(200).json({ reset: true });
});

// ─── HEALTH ──────────────────────────────────────────────────────────────────

app.get('/api/v1/health', (_req, res) => {
  return res.status(200).json({ status: 'ok', services: ['auth', 'payments', 'transactions', 'account', 'admin'] });
});

// ─── NOTIFICATION SERVICE ────────────────────────────────────────────────────

app.get('/api/v1/notifications', (req, res) => {
  const decoded = verifyToken(req.headers.authorization);
  if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

  const userNotifications = notifications
    .filter(n => n.userId === decoded.userId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  return res.status(200).json({
    data: userNotifications,
    total: userNotifications.length,
  });
});

app.get('/api/v1/notifications/unread/count', (req, res) => {
  const decoded = verifyToken(req.headers.authorization);
  if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

  const count = notifications.filter(
    n => n.userId === decoded.userId && !n.read
  ).length;

  return res.status(200).json({ count });
});

app.patch('/api/v1/notifications/:id/read', (req, res) => {
  const decoded = verifyToken(req.headers.authorization);
  if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

  const notif = notifications.find(n => n.id === req.params.id);
  if (!notif) return res.status(404).json({ error: 'Notification not found' });

  if (notif.userId !== decoded.userId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  notif.read = true;
  return res.status(200).json(notif);
});

// ─── KYC WEBHOOK ─────────────────────────────────────────────────────────────

app.post('/api/v1/webhooks/kyc', (req, res) => {
  const { user_id, status, signature } = req.body ?? {};

  if (!user_id || !status) {
    return res.status(422).json({ error: 'Missing user_id or status' });
  }

  if (!signature || signature !== 'valid-sig') {
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }

  if (!['approved', 'rejected'].includes(status)) {
    return res.status(422).json({ error: 'status must be approved or rejected' });
  }

  const user = Object.values(USERS).find(u => u.userId === user_id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  user.kyc_status = status;
  if (status === 'approved') user.spending_limit = 5000.00;

  notifications.push({
    id: `notif-${Date.now()}`,
    userId: user_id,
    type: status === 'approved' ? 'kyc_approved' : 'kyc_rejected',
    message: status === 'approved'
      ? 'Your KYC verification has been approved. You can now make payments.'
      : 'Your KYC verification was rejected. Please contact support.',
    read: false,
    created_at: new Date().toISOString(),
  });

  return res.status(200).json({ received: true, user_id, kyc_status: status });
});

// ─── GRAPHQL ─────────────────────────────────────────────────────────────────

app.post('/graphql', (req, res) => {
  const decoded = verifyToken(req.headers.authorization);
  if (!decoded) return res.status(401).json({ errors: [{ message: 'Unauthorized' }] });

  const { query } = req.body ?? {};
  if (!query) return res.status(400).json({ errors: [{ message: 'Missing query' }] });

  const userTransactions = payments.filter(p => p.userId === decoded.userId);

  if (query.includes('transactions')) {
    return res.status(200).json({
      data: {
        transactions: userTransactions.map(t => ({
          id: t.id,
          amount: t.amount,
          currency: t.currency,
          status: t.status,
          created_at: t.created_at,
        })),
      },
    });
  }

  if (query.includes('balance')) {
    const user = Object.values(USERS).find(u => u.userId === decoded.userId);
    return res.status(200).json({
      data: {
        balance: { amount: user?.balance ?? 0, currency: 'EUR' },
      },
    });
  }

  return res.status(400).json({ errors: [{ message: 'Unknown query' }] });
});

// ─── START ───────────────────────────────────────────────────────────────────

app.listen(PORT, () => console.log(`Mock server running on http://localhost:${PORT}`));
