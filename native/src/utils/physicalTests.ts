import { collection, limit, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../services/firebase';

export interface SubscribePhysicalTestsOptions {
  uid?: string | null;
  evoMemberId?: string | number | null;
  includeUserSubcollection?: boolean;
}

export function getPhysicalTestMillis(rawDate: any): number {
  if (!rawDate) return 0;
  if (typeof rawDate?.toMillis === 'function') return rawDate.toMillis();
  if (typeof rawDate?.seconds === 'number') return rawDate.seconds * 1000;
  if (rawDate instanceof Date) {
    const t = rawDate.getTime();
    return Number.isNaN(t) ? 0 : t;
  }
  if (typeof rawDate === 'string') {
    const trimmed = rawDate.trim();
    const brMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (brMatch) {
      const t = new Date(
        Number(brMatch[3]),
        Number(brMatch[2]) - 1,
        Number(brMatch[1]),
        12,
        0,
        0
      ).getTime();
      if (!Number.isNaN(t)) return t;
    }
    const parsed = new Date(trimmed).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

export function getPhysicalTestScore(test: any): number | string | null {
  if (!test) return null;
  const raw = test.score ?? test.pontuacao ?? null;
  if (raw === undefined || raw === null) return null;
  if (typeof raw === 'string' && raw.trim() === '') return null;
  return raw;
}

export function subscribeUserPhysicalTests(
  options: SubscribePhysicalTestsOptions,
  onChange: (tests: any[]) => void
): () => void {
  const cleanUid = typeof options.uid === 'string' ? options.uid.trim() : '';
  const rawEvo = options.evoMemberId;
  const evoStr =
    rawEvo !== undefined && rawEvo !== null && String(rawEvo).trim() !== ''
      ? String(rawEvo).trim()
      : '';
  const evoNum =
    evoStr && !Number.isNaN(Number(evoStr)) && Number.isFinite(Number(evoStr))
      ? Number(evoStr)
      : null;
  const includeSubcol = Boolean(cleanUid && options.includeUserSubcollection);

  const buckets: Record<string, any[]> = {};
  const settledSources = new Set<string>();
  const unsubs: (() => void)[] = [];
  let totalListeners = 0;

  const mergeAndEmit = (sourceKey: string) => {
    settledSources.add(sourceKey);

    const byId = new Map<string, any>();
    const signatureSet = new Set<string>();

    const pushTopLevel = (items: any[]) => {
      for (const item of items) {
        if (!item?.id) continue;
        byId.set(item.id, item);
        const ms = getPhysicalTestMillis(item.date || item.createdAt);
        const score = getPhysicalTestScore(item);
        if (ms > 0 && score !== null) {
          signatureSet.add(`${Math.floor(ms / 86400000)}_${String(score)}`);
        }
      }
    };

    pushTopLevel(buckets.userId || []);
    pushTopLevel(buckets.evoNum || []);
    pushTopLevel(buckets.evoStr || []);

    for (const item of buckets.subcol || []) {
      if (!item?.id) continue;
      if (byId.has(item.id)) continue;
      const ms = getPhysicalTestMillis(item.date || item.createdAt);
      const score = getPhysicalTestScore(item);
      const sig = ms > 0 && score !== null ? `${Math.floor(ms / 86400000)}_${String(score)}` : '';
      if (sig && signatureSet.has(sig)) continue;
      byId.set(`sub:${item.id}`, item);
    }

    const sorted = Array.from(byId.values()).sort((a, b) => {
      const aMs = getPhysicalTestMillis(a.date || a.createdAt);
      const bMs = getPhysicalTestMillis(b.date || b.createdAt);
      return bMs - aMs;
    });

    if (sorted.length > 0 || settledSources.size >= totalListeners) {
      onChange(sorted);
    }
  };

  const attach = (sourceKey: string, q: any) => {
    totalListeners += 1;
    const unsub = onSnapshot(
      q,
      (snap: any) => {
        buckets[sourceKey] = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
        mergeAndEmit(sourceKey);
      },
      (err: any) => {
        console.warn(`[physicalTests:${sourceKey}] listener warning:`, err?.message || err);
        buckets[sourceKey] = [];
        mergeAndEmit(sourceKey);
      }
    );
    unsubs.push(unsub);
  };

  const testsCol = collection(db, 'physicalTests');

  if (cleanUid) {
    attach('userId', query(testsCol, where('userId', '==', cleanUid), limit(50)));
  }

  if (evoNum !== null) {
    attach('evoNum', query(testsCol, where('evoMemberId', '==', evoNum), limit(50)));
  }

  if (evoStr) {
    attach('evoStr', query(testsCol, where('evoMemberId', '==', evoStr), limit(50)));
  }

  if (includeSubcol) {
    attach(
      'subcol',
      query(collection(db, 'users', cleanUid, 'physicalTests'), limit(50))
    );
  }

  if (totalListeners === 0) {
    onChange([]);
    return () => {};
  }

  return () => {
    unsubs.forEach((fn) => {
      try {
        fn();
      } catch {
        // ignore unsubscribe errors
      }
    });
  };
}
