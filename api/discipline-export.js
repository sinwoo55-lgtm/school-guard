import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function serviceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not configured.');
  return JSON.parse(raw);
}

function database() {
  const app = getApps().length ? getApps()[0] : initializeApp({ credential: cert(serviceAccount()) });
  return getFirestore(app);
}

function authorized(req) {
  const secret = process.env.DISCIPLINE_SYNC_SECRET;
  return Boolean(secret) && req.headers.authorization === `Bearer ${secret}`;
}

function value(value, length = 120) {
  return typeof value === 'string' || typeof value === 'number' ? String(value).trim().slice(0, length) : '';
}

function dateValue(value) {
  if (typeof value === 'string') return value.slice(0, 10);
  if (value?.toDate) return value.toDate().toISOString().slice(0, 10);
  return '';
}

function timeValue(value) {
  if (value?.toMillis) return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed.' });
  if (!authorized(req)) return res.status(401).json({ error: 'Unauthorized.' });

  try {
    const db = database();
    const [violations, stats] = await Promise.all([
      db.collection('violations').get(),
      db.collection('studentStats').get()
    ]);
    const resetTimes = new Map(stats.docs.map((doc) => [doc.id, timeValue(doc.data().lastResetAt)]));
    const records = violations.docs.map((doc) => {
      const row = doc.data();
      const resetAt = resetTimes.get(value(row.studentId)) || 0;
      const recordedAt = timeValue(row.timestamp) || timeValue(row.date);
      // 정보 허브에는 현재 집계 기간의 유효한 기록만 전달한다. 선도부에서는 이전·삭제 기록을 계속 보관한다.
      if (row.deleted === true || (resetAt && (!recordedAt || recordedAt <= resetAt))) return null;
      return {
        id: doc.id,
        studentId: value(row.studentId), studentName: value(row.studentName, 60),
        grade: value(row.grade, 10), classNo: value(row.class, 10), number: value(row.number, 10),
        reason: value(row.reason, 120), reasonDetail: value(row.reasonDetail, 1000),
        date: dateValue(row.date) || dateValue(row.timestamp),
        counted: row.counted === true, isExtraService: row.isExtraService === true
      };
    }).filter((row) => row && row.grade && row.classNo && row.number && row.studentName);
    const summaries = stats.docs.map((doc) => {
      const row = doc.data();
      return {
        studentId: doc.id, studentName: value(row.studentName, 60),
        grade: value(row.grade, 10), classNo: value(row.class, 10), number: value(row.number, 10),
        violationCount: Number(row.violationCount) || 0,
        serviceCompletedCount: Number(row.serviceCompletedCount) || 0,
        extraServiceOrders: Number(row.extraServiceOrders) || 0
      };
    }).filter((row) => row.grade && row.classNo && row.number && row.studentName && row.violationCount > 0);
    return res.status(200).json({ exportedAt: new Date().toISOString(), records, summaries });
  } catch (error) {
    console.error('discipline export error', error);
    return res.status(500).json({ error: 'Unable to export discipline data.' });
  }
}
