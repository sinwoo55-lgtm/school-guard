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
  const parsed = Array.isArray(req.body?.students) ? req.body.students.map(normalize).filter(Boolean) : null;
  if (!parsed || parsed.length > 2000) return res.status(400).json({ error: 'Invalid roster payload.' });
  const rows = [...parsed.reduce((unique, row) => {
    const previous = unique.get(row.key);
    if (!previous || (row.status !== '전출' && previous.status === '전출')) unique.set(row.key, row);
    return unique;
  }, new Map()).values()];
  try {
    const firestore = db(), collection = firestore.collection('students');
    const existing = await collection.get(), existingGroups = new Map();
    existing.docs.forEach((doc) => {
      const row = doc.data(), key = `${string(row.grade, 10)}-${string(row.class, 10)}-${string(row.number, 10)}`;
      const group = existingGroups.get(key) || [];
      group.push(doc);
      existingGroups.set(key, group);
    });
    const existingByKey = new Map(), duplicateIds = new Set();
    existingGroups.forEach((group, key) => {
      // 같은 학번의 과거 문서는 삭제하지 않고 비활성화한다. 가장 최근 문서를 원본 반영 대상으로 쓴다.
      group.sort((a, b) => {
        const aTime = a.data().updatedAt?.toMillis?.() || 0, bTime = b.data().updatedAt?.toMillis?.() || 0;
        return bTime - aTime || a.id.localeCompare(b.id);
      });
      existingByKey.set(key, group[0]);
      group.slice(1).forEach((doc) => duplicateIds.add(doc.id));
    });
    const incoming = new Set(rows.map((row) => row.key));
    const writes = rows.map((row) => ({ row, doc: existingByKey.get(row.key) }));
    for (const part of chunks(writes)) {
      const batch = firestore.batch();
      part.forEach(({ row, doc }) => batch.set(doc?.ref || collection.doc(), { grade: Number(row.grade) || row.grade, class: Number(row.classNo) || row.classNo, number: Number(row.number) || row.number, name: row.name, active: row.status !== '전출', hubRosterKey: row.key, updatedAt: new Date() }, { merge: true }));
      await batch.commit();
    }
    const toDeactivate = existing.docs.filter((doc) => {
      const row = doc.data(); const key = `${string(row.grade, 10)}-${string(row.class, 10)}-${string(row.number, 10)}`;
      return row.active !== false && (duplicateIds.has(doc.id) || !incoming.has(key));
    });
    const duplicateDeactivated = toDeactivate.filter((doc) => duplicateIds.has(doc.id)).length;
    for (const part of chunks(toDeactivate)) {
      const batch = firestore.batch(); part.forEach((doc) => batch.update(doc.ref, { active: false, updatedAt: new Date() })); await batch.commit();
    }
    return res.status(200).json({ imported: rows.length, deactivated: toDeactivate.length, duplicateDeactivated });
  } catch (error) { console.error('roster import error', error); return res.status(500).json({ error: 'Unable to import roster.' }); }
}
