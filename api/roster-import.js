import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function db() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not configured.');
  const app = getApps().length ? getApps()[0] : initializeApp({ credential: cert(JSON.parse(raw)) });
  return getFirestore(app);
}
function authorized(req) {
  const secret = process.env.SCHOOL_GUARD_ROSTER_SECRET;
  return Boolean(secret) && req.headers.authorization === `Bearer ${secret}`;
}
function string(value, max = 60) { return typeof value === 'string' || typeof value === 'number' ? String(value).trim().slice(0, max) : ''; }
function normalize(value) {
  const grade = string(value?.grade, 10), classNo = string(value?.classNo, 10), number = string(value?.number, 10), name = string(value?.name, 60);
  const status = ['재학', '전입', '전출'].includes(value?.status) ? value.status : '재학';
  return grade && classNo && number && name ? { grade, classNo, number, name, status, key: `${grade}-${classNo}-${number}` } : null;
}
const chunks = (items, size = 400) => Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size));

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  if (!authorized(req)) return res.status(401).json({ error: 'Unauthorized.' });
  const rows = Array.isArray(req.body?.students) ? req.body.students.map(normalize).filter(Boolean) : null;
  if (!rows || rows.length > 2000) return res.status(400).json({ error: 'Invalid roster payload.' });
  if (new Set(rows.map((row) => row.key)).size !== rows.length) return res.status(400).json({ error: 'Duplicate student keys.' });
  try {
    const firestore = db(), collection = firestore.collection('students');
    const existing = await collection.get(), existingByKey = new Map(existing.docs.map((doc) => {
      const row = doc.data(); return [`${string(row.grade, 10)}-${string(row.class, 10)}-${string(row.number, 10)}`, doc];
    }));
    const incoming = new Set(rows.map((row) => row.key));
    const writes = rows.map((row) => ({ row, doc: existingByKey.get(row.key) }));
    for (const part of chunks(writes)) {
      const batch = firestore.batch();
      part.forEach(({ row, doc }) => batch.set(doc?.ref || collection.doc(), { grade: Number(row.grade) || row.grade, class: Number(row.classNo) || row.classNo, number: Number(row.number) || row.number, name: row.name, active: row.status !== '전출', hubRosterKey: row.key, updatedAt: new Date() }, { merge: true }));
      await batch.commit();
    }
    const toDeactivate = existing.docs.filter((doc) => {
      const row = doc.data(); const key = `${string(row.grade, 10)}-${string(row.class, 10)}-${string(row.number, 10)}`;
      return row.active !== false && !incoming.has(key);
    });
    for (const part of chunks(toDeactivate)) {
      const batch = firestore.batch(); part.forEach((doc) => batch.update(doc.ref, { active: false, updatedAt: new Date() })); await batch.commit();
    }
    return res.status(200).json({ imported: rows.length, deactivated: toDeactivate.length });
  } catch (error) { console.error('roster import error', error); return res.status(500).json({ error: 'Unable to import roster.' }); }
}
