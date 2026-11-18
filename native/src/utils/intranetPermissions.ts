export interface KihapUnitOption {
  id: string;
  name: string;
}

export const KIHAP_UNITS: KihapUnitOption[] = [
  { id: 'centro', name: 'Centro' },
  { id: 'coqueiros', name: 'Coqueiros' },
  { id: 'santa-monica', name: 'Santa Mônica' },
  { id: 'asa-sul', name: 'Asa Sul' },
  { id: 'sudoeste', name: 'Sudoeste' },
  { id: 'lago-sul', name: 'Lago Sul' },
  { id: 'jardim-botanico', name: 'Jardim Botânico' },
  { id: 'noroeste', name: 'Noroeste' },
  { id: 'pontos-de-ensino', name: 'Pontos de Ensino' },
  { id: 'dourados', name: 'Dourados' },
];

export type IntranetModuleKey = 'grade' | 'alunos' | 'tatame' | 'crm' | 'store' | 'analise';

export interface IntranetModuleMeta {
  key: IntranetModuleKey;
  tabName: string;
  route: string;
  label: string;
  pageKeys: string[];
}

export const INTRANET_MODULES: IntranetModuleMeta[] = [
  { key: 'grade', tabName: 'intranet-grade', route: '/(tabs)/intranet-grade', label: 'Grade', pageKeys: ['grade.html'] },
  { key: 'alunos', tabName: 'intranet-alunos', route: '/(tabs)/intranet-alunos', label: 'Alunos', pageKeys: ['alunos.html', 'aluno.html'] },
  { key: 'tatame', tabName: 'intranet-tatame', route: '/(tabs)/intranet-tatame', label: 'Tatame', pageKeys: ['tatame.html', 'planificador.html'] },
  { key: 'crm', tabName: 'intranet-crm', route: '/(tabs)/intranet-crm', label: 'CRM', pageKeys: ['prospeccao.html', 'leads-analysis.html'] },
  { key: 'store', tabName: 'intranet-store', route: '/(tabs)/intranet-store', label: 'Store', pageKeys: ['store.html', 'sales-history.html', 'pedidos.html', 'estoque.html'] },
  { key: 'analise', tabName: 'intranet-analise', route: '/(tabs)/intranet-analise', label: 'Análise', pageKeys: ['analysis.html', 'analise.html', 'app-analytics.html'] },
];

function isFlagTrue(val: any): boolean {
  return val === true || val === 'true';
}

export function hasIntranetAccess(userData: any): boolean {
  if (!userData) return false;
  if (
    isFlagTrue(userData.isAdmin) ||
    isFlagTrue(userData.isInstructor) ||
    isFlagTrue(userData.isAdministrativo) ||
    isFlagTrue(userData.isStore) ||
    isFlagTrue(userData.isRH) ||
    isFlagTrue(userData.isMarketing) ||
    isFlagTrue(userData.isJuridico) ||
    isFlagTrue(userData.isSuporte) ||
    isFlagTrue(userData.isColarinhoPreto) ||
    isFlagTrue(userData.isBlackCollar) ||
    isFlagTrue(userData.colarinhoPreto) ||
    String(userData.unitId || '').toLowerCase() === 'staff' ||
    String(userData.unidadeId || '').toLowerCase() === 'staff'
  ) {
    return true;
  }

  return Array.isArray(userData.allowedPages) && userData.allowedPages.length > 0;
}

export function canAccessIntranetModule(userData: any, moduleKey: IntranetModuleKey): boolean {
  if (!hasIntranetAccess(userData)) return false;
  if (isFlagTrue(userData.isAdmin)) return true;

  const meta = INTRANET_MODULES.find(m => m.key === moduleKey);
  if (!meta) return false;

  if (Array.isArray(userData.allowedPages)) {
    return meta.pageKeys.some(pageKey => userData.allowedPages.includes(pageKey));
  }

  // Fallback para usuários legados sem array explícito allowedPages
  const isInstructor = isFlagTrue(userData.isInstructor);
  const isAdministrativo = isFlagTrue(userData.isAdministrativo);
  const isMarketing = isFlagTrue(userData.isMarketing);
  const isColarinho = isFlagTrue(userData.isColarinhoPreto) || isFlagTrue(userData.isBlackCollar) || isFlagTrue(userData.colarinhoPreto);
  const storePerms = userData.storePermissions || {};

  switch (moduleKey) {
    case 'grade':
      return isInstructor || isAdministrativo || isColarinho;
    case 'alunos':
      return true;
    case 'tatame':
      return isInstructor || isColarinho || isAdministrativo;
    case 'crm':
      return isMarketing || isAdministrativo || isInstructor;
    case 'store':
      return isFlagTrue(userData.isStore) || Boolean(storePerms.loja || storePerms.pedidos || storePerms.estoque);
    case 'analise':
      return isAdministrativo;
    default:
      return false;
  }
}

export function getFirstAllowedIntranetRoute(userData: any): string {
  const firstAllowed = INTRANET_MODULES.find(m => canAccessIntranetModule(userData, m.key));
  return firstAllowed ? firstAllowed.route : '/(tabs)/intranet-alunos';
}

export function formatUnitName(rawUnit?: string | null): string {
  if (!rawUnit) return 'Geral';
  const normalized = String(rawUnit)
    .toLowerCase()
    .replace(/^kihap\s*-\s*/i, '')
    .trim();
  const found = KIHAP_UNITS.find(
    u => u.id === normalized || u.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  );
  if (found) return found.name;
  return String(rawUnit)
    .replace(/^KIHAP\s*-\s*/i, '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

export function normalizeSearchText(str?: string | null): string {
  return (str || '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
