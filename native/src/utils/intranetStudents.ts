import { collection, getDocs, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../services/firebase';
import { normalizeSearchText } from './intranetPermissions';

export function extractStudentPhone(student: any): string {
  if (!student) return '';
  if (student.phone && String(student.phone).trim()) {
    return String(student.phone).trim();
  }
  if (!Array.isArray(student.contacts)) return '';

  const phoneContact =
    student.contacts.find(
      (c: any) =>
        c?.description &&
        (c.idContactType === 1 ||
          c.idContactType === 2 ||
          /celular|telefone|whatsapp|fone/i.test(c.contactType || ''))
    ) ||
    student.contacts.find(
      (c: any) =>
        c?.description &&
        c.idContactType !== 4 &&
        !/e-?mail/i.test(c.contactType || '')
    );

  return phoneContact?.description ? String(phoneContact.description).trim() : '';
}

export function extractStudentEmail(student: any): string {
  if (!student) return '';
  if (student.email && String(student.email).trim()) {
    return String(student.email).trim();
  }
  if (!Array.isArray(student.contacts)) return '';
  const emailContact = student.contacts.find(
    (c: any) => c?.description && (c.idContactType === 4 || /e-?mail/i.test(c.contactType || ''))
  );
  return emailContact?.description ? String(emailContact.description).trim() : '';
}

export function matchesStudentQuery(student: any, rawQuery: string): boolean {
  const normalizedQuery = normalizeSearchText(rawQuery);
  if (!normalizedQuery) return true;

  const idStr = String(student?.idMember || student?.id || '').trim();
  if (idStr && idStr === String(rawQuery || '').trim()) {
    return true;
  }

  const fullName = normalizeSearchText(`${student?.firstName || ''} ${student?.lastName || ''} ${student?.name || ''}`);
  if (fullName.includes(normalizedQuery)) {
    return true;
  }

  const tokens = normalizedQuery.split(' ').filter(Boolean);
  return tokens.length > 0 && tokens.every((t) => fullName.includes(t));
}

export function matchesStudentUnit(student: any, selectedUnit: string): boolean {
  if (!selectedUnit || selectedUnit === 'all' || selectedUnit === 'geral') {
    return true;
  }
  const target = selectedUnit.toLowerCase().trim();
  const studentUnit = String(student?.unitId || '').toLowerCase().trim();
  if (studentUnit === target) return true;

  const normBranch = normalizeSearchText(student?.branchName)
    .replace(/^kihap\s*-\s*/, '')
    .trim()
    .replace(/\s+/g, '-');
  return normBranch === target;
}

export async function fetchStudentsByUnit(unitId: string = 'all'): Promise<any[]> {
  try {
    const listAlunosLocais = httpsCallable(functions, 'listAlunosLocais');
    const res = await listAlunosLocais({ unitId: unitId || 'all' });
    const data = res.data as any[];
    if (Array.isArray(data)) {
      return data;
    }
  } catch (err) {
    console.warn('Fallback para Firestore evo_students em fetchStudentsByUnit:', err);
  }

  const col = collection(db, 'evo_students');
  const q = unitId && unitId !== 'all' ? query(col, where('unitId', '==', unitId)) : col;
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return { ...data, idMember: data.idMember || d.id };
  });
}

// ─── Análise de Baixas e Retornos (Contratos EVO) ───────────────────────────────

const EXCLUDED_CONTRACT_REGEX = /experimental|di[aá]ria|aula\s*avulsa|visitante|cortesia|free\s*pass/i;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

export type ChurnPeriodKey = '30d' | '90d' | 'this_month' | 'this_year' | 'all';

export interface ReturnEvent {
  baixaDate: Date;
  returnDate: Date;
  gapDays: number;
  prevPlan: string;
  currentPlan: string;
  wasCanceled: boolean;
}

export interface StudentChurnAnalysis {
  hasContracts: boolean;
  isActive: boolean;
  returnEvents: ReturnEvent[];
  baixa: {
    baixaDate: Date;
    lastPlan: string;
    wasCanceled: boolean;
  } | null;
}

export function parseEvoDate(dateVal: any): Date | null {
  if (!dateVal) return null;
  if (typeof dateVal?.toDate === 'function') {
    const d = dateVal.toDate();
    return isNaN(d.getTime()) ? null : d;
  }
  const parsed = new Date(dateVal);
  return isNaN(parsed.getTime()) ? null : parsed;
}

export function isStudentCurrentlyActive(student: any): boolean {
  const s = String(student?.status ?? '').toLowerCase().trim();
  const ms = String(student?.membershipStatus ?? '').toLowerCase().trim();
  if (s === 'active' || s === 'ativo' || s === '1' || ms === 'active' || ms === 'ativo') {
    return true;
  }
  if (Array.isArray(student?.memberships)) {
    return student.memberships.some((m: any) => String(m?.membershipStatus || '').toLowerCase() === 'active');
  }
  return false;
}

export function getChurnPeriodBounds(periodKey: ChurnPeriodKey): { start: Date | null; end: Date | null } {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  if (periodKey === '30d') {
    return { start: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30, 0, 0, 0, 0), end };
  }
  if (periodKey === '90d') {
    return { start: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 90, 0, 0, 0, 0), end };
  }
  if (periodKey === 'this_month') {
    return { start: new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0), end };
  }
  if (periodKey === 'this_year') {
    return { start: new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0), end };
  }
  return { start: null, end: null };
}

export function isDateWithinBounds(dateObj: Date | null, bounds: { start: Date | null; end: Date | null }): boolean {
  if (!bounds || (!bounds.start && !bounds.end)) return true;
  if (!dateObj || isNaN(dateObj.getTime())) return false;
  const ts = dateObj.getTime();
  if (bounds.start && ts < bounds.start.getTime()) return false;
  if (bounds.end && ts > bounds.end.getTime()) return false;
  return true;
}

export function formatGapDuration(days: number): string {
  const safeDays = Math.max(0, Math.round(days || 0));
  if (safeDays < 30) {
    return `${safeDays} ${safeDays === 1 ? 'dia' : 'dias'}`;
  }
  if (safeDays < 365) {
    const months = Math.max(1, Math.round(safeDays / 30));
    return `${months} ${months === 1 ? 'mês' : 'meses'} (${safeDays}d)`;
  }
  const years = (safeDays / 365).toFixed(1).replace('.', ',');
  return `${years} anos (${safeDays}d)`;
}

export function analyzeStudentContracts(student: any): StudentChurnAnalysis {
  const rawMemberships = Array.isArray(student?.memberships) ? student.memberships : [];
  const realContracts = rawMemberships
    .filter((ms: any) => ms && ms.startDate && !EXCLUDED_CONTRACT_REGEX.test(ms.name || ''))
    .map((ms: any) => {
      const startDt = parseEvoDate(ms.startDate);
      const endDt = parseEvoDate(ms.cancelDate || ms.endDate || ms.startDate);
      const msStatus = String(ms.membershipStatus || '').toLowerCase();
      const wasCanceled = Boolean(ms.cancelDate || msStatus === 'canceled' || msStatus === 'cancelled');
      return { raw: ms, startDt, endDt, wasCanceled };
    })
    .filter((c: any) => c.startDt !== null)
    .sort((a: any, b: any) => {
      const diff = a.startDt.getTime() - b.startDt.getTime();
      if (diff !== 0) return diff;
      return (Number(a.raw.idMemberMembership) || 0) - (Number(b.raw.idMemberMembership) || 0);
    });

  const isActive = isStudentCurrentlyActive(student);
  if (realContracts.length === 0) {
    return { hasContracts: false, isActive, returnEvents: [], baixa: null };
  }

  const returnEvents: ReturnEvent[] = [];
  let maxCoverageEnd = realContracts[0].endDt;
  let lastCoveringContract = realContracts[0];

  for (let i = 1; i < realContracts.length; i++) {
    const curr = realContracts[i];
    if (maxCoverageEnd && curr.startDt) {
      const gapDays = Math.round((curr.startDt.getTime() - maxCoverageEnd.getTime()) / MS_PER_DAY);
      const isReturnTransition =
        gapDays > 30 ||
        (lastCoveringContract.wasCanceled && gapDays > 7 && !curr.raw.idMemberMembershipRenewed);

      if (isReturnTransition) {
        returnEvents.push({
          baixaDate: maxCoverageEnd,
          returnDate: curr.startDt,
          gapDays: Math.max(0, gapDays),
          prevPlan: lastCoveringContract.raw.name || 'Contrato anterior',
          currentPlan: curr.raw.name || 'Novo contrato',
          wasCanceled: lastCoveringContract.wasCanceled,
        });
      }
    }

    if (curr.endDt && (!maxCoverageEnd || curr.endDt.getTime() > maxCoverageEnd.getTime())) {
      maxCoverageEnd = curr.endDt;
      lastCoveringContract = curr;
    }
  }

  let baixa: StudentChurnAnalysis['baixa'] = null;
  if (!isActive) {
    const orderedByEnd = [...realContracts].sort((a, b) => {
      const aTime = a.endDt ? a.endDt.getTime() : 0;
      const bTime = b.endDt ? b.endDt.getTime() : 0;
      return aTime - bTime;
    });
    const lastContract = orderedByEnd[orderedByEnd.length - 1];
    if (lastContract && lastContract.endDt) {
      baixa = {
        baixaDate: lastContract.endDt,
        lastPlan: lastContract.raw.name || 'N/A',
        wasCanceled: lastContract.wasCanceled,
      };
    }
  }

  return { hasContracts: true, isActive, returnEvents, baixa };
}
