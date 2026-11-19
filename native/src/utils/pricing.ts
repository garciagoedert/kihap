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

  const rawPrice = product.priceType === 'kit'
    ? (typeof product.kitBasePrice === 'number' ? product.kitBasePrice : (typeof product.price === 'number' ? product.price : 0))
    : (typeof product.price === 'number' ? product.price : 0);
  const rawPromo = typeof product.promoPrice === 'number' && product.promoPrice > 0 ? product.promoPrice : null;
  const kitOriginalPrice = (product.priceType === 'kit' && typeof product.kitOriginalPrice === 'number' && product.kitOriginalPrice > 0)
    ? product.kitOriginalPrice
    : null;

  const basePrice = (kitOriginalPrice && kitOriginalPrice > rawPrice) ? kitOriginalPrice : rawPrice;
  const promoPrice = product.priceType === 'kit'
    ? ((rawPromo && rawPromo < rawPrice) ? rawPromo : ((kitOriginalPrice && kitOriginalPrice > rawPrice) ? rawPrice : null))
    : rawPromo;

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

/**
 * Formats kit item summaries (quantity, chosen option/size, gift indicator) for cart/checkout display.
 */
export function formatKitSelectionLines(form: any): string[] {
  if (!form) return [];
  if (Array.isArray(form.kitItemsSnapshot) && form.kitItemsSnapshot.length > 0) {
    return form.kitItemsSnapshot.map((k: any) => {
      const chosen = form.kitSelections?.[k.name];
      const qtyPrefix = k.quantity && k.quantity > 1 ? `${k.quantity}x ` : '';
      const giftTag = k.isGift ? ' (Brinde)' : '';
      return `${qtyPrefix}${k.name}${chosen ? `: ${chosen}` : ''}${giftTag}`;
    });
  }
  if (form.kitSelections && typeof form.kitSelections === 'object') {
    return Object.entries(form.kitSelections).map(([name, opt]) => `${name}: ${opt}`);
  }
  return [];
}

/**
 * Retorna o mapa efetivo de estoque por tamanho, conciliando sizeStock e cdStock.
 */
export function getProductSizeStockMap(product: any): Record<string, number> {
  const rootSizes: Record<string, number> = {};
  let rootSum = 0;
  if (product?.sizeStock && typeof product.sizeStock === 'object') {
    for (const [k, v] of Object.entries(product.sizeStock)) {
      if (v !== undefined && v !== null) {
        const q = Math.max(0, Number(v) || 0);
        rootSizes[k] = q;
        rootSum += q;
      }
    }
  }

  const cdSizes: Record<string, number> = {};
  let cdTotalSum = 0;
  let cdHasSizes = false;
  if (product?.cdStock && typeof product.cdStock === 'object') {
    for (const cd of Object.values(product.cdStock) as any[]) {
      cdTotalSum += Math.max(0, Number(cd?.total) || 0);
      if (cd?.sizes && typeof cd.sizes === 'object') {
        for (const [k, v] of Object.entries(cd.sizes)) {
          cdHasSizes = true;
          cdSizes[k] = (cdSizes[k] || 0) + Math.max(0, Number(v) || 0);
        }
      }
    }
  }

  if (
    cdHasSizes &&
    (Object.keys(rootSizes).length === 0 ||
      (typeof product?.stockQuantity === 'number' &&
        cdTotalSum === product.stockQuantity &&
        rootSum !== cdTotalSum))
  ) {
    return cdSizes;
  }
  return rootSizes;
}

/**
 * Retorna o estoque total efetivo de um produto (0 quando zerado).
 */
export function getProductTotalStock(product: any): number {
  if (!product) return 0;
  if (typeof product.stockQuantity === 'number' && product.stockQuantity <= 0) {
    return 0;
  }
  const sizeMap = getProductSizeStockMap(product);
  if (product.hasSizes && Object.keys(sizeMap).length > 0) {
    const sizeSum = Object.values(sizeMap).reduce((sum, q) => sum + Math.max(0, Number(q) || 0), 0);
    return typeof product.stockQuantity === 'number' ? Math.min(product.stockQuantity, sizeSum) : sizeSum;
  }
  if (typeof product.stockQuantity === 'number') {
    return Math.max(0, product.stockQuantity);
  }
  if (product.cdStock && typeof product.cdStock === 'object' && Object.keys(product.cdStock).length > 0) {
    return (Object.values(product.cdStock) as any[]).reduce(
      (sum, cd) => sum + Math.max(0, Number(cd?.total) || 0),
      0
    );
  }
  return 0;
}

/**
 * Retorna a quantidade em estoque para um tamanho específico (ou null quando não controla por tamanho).
 */
export function getProductSizeStock(product: any, size?: string | null): number | null {
  if (!size) return null;
  const sizeMap = getProductSizeStockMap(product);
  if (Object.keys(sizeMap).length === 0) return null;
  if (sizeMap[size] !== undefined) return Number(sizeMap[size]) || 0;
  const lower = String(size).trim().toLowerCase();
  for (const [k, v] of Object.entries(sizeMap)) {
    if (String(k).trim().toLowerCase() === lower) {
      return Number(v) || 0;
    }
  }
  return 0;
}

/**
 * Determina se o produto está disponível para venda levando em conta available, data limite e controlStock.
 */
export function isProductAvailableForPurchase(product: any): boolean {
  if (!product) return false;
  if (product.available === false) return false;
  if (product.availabilityDate && new Date() > new Date(product.availabilityDate)) {
    return false;
  }
  if (product.controlStock && getProductTotalStock(product) <= 0) {
    return false;
  }
  return true;
}

