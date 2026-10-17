/**
 * Utilitários para normalização de unidades, identificação de staff
 * e cálculo de preços diferenciados (Staff & Unidade) na Kihap Store,
 * suportando tanto produtos com preço fixo quanto produtos com variações.
 */

export function normalizeUnitSlug(val: any): string {
  if (!val || typeof val !== 'string') return '';
  return val
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^kihap\s*-\s*/i, '')
    .replace(/^kihap\s+/i, '')
    .replace(/^unidade\s+/i, '')
    .replace(/\s*\(.*\)\s*/g, '')
    .trim()
    .replace(/[\s_]+/g, '-');
}

export function isStaffUser(userData: any): boolean {
  if (!userData) return false;
  return !!(
    userData.isAdmin === true ||
    userData.isInstructor === true ||
    userData.isStaff === true ||
    userData.isRH === true ||
    userData.isFinanceiro === true ||
    userData.isAdministrativo === true ||
    userData.isStore === true ||
    userData.isAcademy === true ||
    userData.isJuridico === true ||
    userData.isSuporte === true ||
    userData.unitId === 'staff' ||
    userData.unidadeId === 'staff'
  );
}

export function getUserUnitSlugs(userData: any): string[] {
  if (!userData) return [];
  const rawUnits: any[] = [
    userData.unitId,
    userData.unidade,
    userData.unit,
    userData.branchName,
    userData.currentUnit,
  ];
  if (Array.isArray(userData.units)) rawUnits.push(...userData.units);
  if (Array.isArray(userData.unidades)) rawUnits.push(...userData.unidades);
  if (isStaffUser(userData)) {
    rawUnits.push('staff');
  }

  const slugs = new Set<string>();
  rawUnits.forEach((u) => {
    const slug = normalizeUnitSlug(u);
    if (slug) slugs.add(slug);
  });
  return Array.from(slugs);
}

export interface EffectivePriceResult {
  price: number; // em centavos
  promoPrice?: number | null;
  basePrice: number;
  isStaffPrice: boolean;
  isUnitSpecificPrice: boolean;
  appliedUnitSlug?: string;
  label?: string;
}

/**
 * Retorna o preço efetivo de uma variação específica para o usuário conectado:
 * 1. staffPrice da variação (se for staff)
 * 2. unitPrices da variação para a unidade do aluno (se existir)
 * 3. Preço base da variação como padrão
 */
export function getEffectiveVariantPrice(
  variant: any, 
  userData: any, 
  parentProduct?: any
): { price: number; isStaffPrice: boolean; isUnitSpecificPrice: boolean } {
  if (!variant) return { price: 0, isStaffPrice: false, isUnitSpecificPrice: false };

  // 1. Staff na variação (ou fallback no produto)
  if (isStaffUser(userData)) {
    if (typeof variant.staffPrice === 'number' && variant.staffPrice > 0) {
      return { price: variant.staffPrice, isStaffPrice: true, isUnitSpecificPrice: false };
    }
    if (parentProduct && typeof parentProduct.staffPrice === 'number' && parentProduct.staffPrice > 0) {
      return { price: parentProduct.staffPrice, isStaffPrice: true, isUnitSpecificPrice: false };
    }
  }

  // 2. Unidade do aluno na variação
  const userUnits = getUserUnitSlugs(userData);
  if (variant.unitPrices && typeof variant.unitPrices === 'object') {
    for (const u of userUnits) {
      if (u === 'staff') continue;
      const val = variant.unitPrices[u];
      if (typeof val === 'number' && val > 0) {
        return { price: val, isStaffPrice: false, isUnitSpecificPrice: true };
      }
    }
  }

  // Fallback no produto pai: APENAS para produtos de preço fixo (produtos variáveis possuem preços próprios por variação)
  if (parentProduct && parentProduct.priceType !== 'variable' && parentProduct.unitPrices && typeof parentProduct.unitPrices === 'object') {
    for (const u of userUnits) {
      if (u === 'staff') continue;
      const val = parentProduct.unitPrices[u];
      if (typeof val === 'number' && val > 0) {
        return { price: val, isStaffPrice: false, isUnitSpecificPrice: true };
      }
    }
  }

  // 3. Fallback: preço base da variação
  return {
    price: typeof variant.price === 'number' ? variant.price : 0,
    isStaffPrice: false,
    isUnitSpecificPrice: false,
  };
}

/**
 * Retorna o preço efetivo de um produto:
 * - Se for produto variável, calcula o menor preço efetivo entre as variações para o usuário.
 * - Se for produto de preço fixo, aplica staffPrice ou unitPrices configurados no produto.
 */
export function getEffectiveProductPrice(product: any, userData: any): EffectivePriceResult {
  if (!product) {
    return {
      price: 0,
      basePrice: 0,
      isStaffPrice: false,
      isUnitSpecificPrice: false,
    };
  }

  // Produtos de Preço Variável
  if (product.priceType === 'variable' && Array.isArray(product.priceVariants) && product.priceVariants.length > 0) {
    const effectiveVariants = product.priceVariants.map((v: any) => getEffectiveVariantPrice(v, userData, product));
    const prices = effectiveVariants.map((ev: any) => ev.price);
    const minPrice = Math.min(...prices);
    const hasStaff = effectiveVariants.some((ev: any) => ev.isStaffPrice);
    const hasUnit = effectiveVariants.some((ev: any) => ev.isUnitSpecificPrice);

    const basePrices = product.priceVariants.map((v: any) => typeof v.price === 'number' ? v.price : 0);
    const minBasePrice = Math.min(...basePrices);

    return {
      price: minPrice,
      basePrice: minBasePrice,
      isStaffPrice: hasStaff,
      isUnitSpecificPrice: hasUnit,
      label: hasStaff ? 'Staff' : undefined,
    };
  }

  const basePrice = typeof product.price === 'number' ? product.price : 0;
  const promoPrice = typeof product.promoPrice === 'number' && product.promoPrice > 0 ? product.promoPrice : null;

  // 1. Staff / Equipe override no produto
  if (isStaffUser(userData) && typeof product.staffPrice === 'number' && product.staffPrice > 0) {
    return {
      price: product.staffPrice,
      promoPrice: null,
      basePrice,
      isStaffPrice: true,
      isUnitSpecificPrice: false,
      label: 'Staff',
    };
  }

  // 2. Preço específico por unidade do aluno no produto
  if (product.unitPrices && typeof product.unitPrices === 'object') {
    const userUnits = getUserUnitSlugs(userData);
    for (const u of userUnits) {
      if (u === 'staff') continue;
      const unitVal = product.unitPrices[u];
      if (typeof unitVal === 'number' && unitVal > 0) {
        return {
          price: unitVal,
          promoPrice: null,
          basePrice,
          isStaffPrice: false,
          isUnitSpecificPrice: true,
          appliedUnitSlug: u,
        };
      }
    }
  }

  // 3. Fallback Padrão
  return {
    price: promoPrice ? promoPrice : basePrice,
    promoPrice,
    basePrice,
    isStaffPrice: false,
    isUnitSpecificPrice: false,
  };
}

export function formatCentsToCurrency(cents: number): string {
  return ((cents || 0) / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}
