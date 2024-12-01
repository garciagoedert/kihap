import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Store, Product, Sale, Commission, Promotion } from '../types';
import { initialStores, initialProducts } from '../data';

interface StoreState {
  // State
  stores: Store[];
  products: Product[];
  sales: Sale[];
  commissions: Commission[];
  promotions: Promotion[];

  // Actions
  addStore: (store: Omit<Store, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateStore: (store: Store) => void;
  deleteStore: (id: string) => void;
  
  addProduct: (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateProduct: (product: Product) => void;
  deleteProduct: (id: string) => void;
  
  addSale: (sale: Omit<Sale, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateSale: (sale: Sale) => void;
  deleteSale: (id: string) => void;
  
  addCommission: (commission: Omit<Commission, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateCommission: (commission: Commission) => void;
  deleteCommission: (id: string) => void;
  
  addPromotion: (promotion: Omit<Promotion, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updatePromotion: (promotion: Promotion) => void;
  deletePromotion: (id: string) => void;
  
  getStoreById: (id: string) => Store | undefined;
  getStoreProducts: (storeId: string) => Product[];
  getStoreSales: (storeId: string) => Sale[];
  getStoreCommissions: (storeId: string) => Commission[];
  getProductPromotions: (productId: string) => Promotion[];
  getActivePromotion: (productId: string) => Promotion | undefined;
}

// Função para garantir que o estado tenha os dados iniciais necessários
const ensureInitialData = (state: Partial<StoreState>): StoreState => {
  return {
    stores: state.stores?.length ? state.stores : initialStores,
    products: state.products?.length ? state.products : initialProducts,
    sales: state.sales || [],
    commissions: state.commissions || [],
    promotions: state.promotions || [],
  } as StoreState;
};

export const useStoreStore = create<StoreState>()(
  persist(
    (set, get) => ({
      // Initial State
      stores: initialStores,
      products: initialProducts,
      sales: [],
      commissions: [],
      promotions: [],

      // Store Actions
      addStore: (store) => {
        const newStore = {
          ...store,
          id: Date.now().toString(),
          createdAt: new Date(),
          updatedAt: new Date()
        };

        set((state) => ({
          stores: [...state.stores, newStore]
        }));

        return newStore.id;
      },

      updateStore: (store) => {
        set((state) => ({
          stores: state.stores.map((s) => s.id === store.id ? store : s)
        }));
      },

      deleteStore: (id) => {
        set((state) => ({
          stores: state.stores.filter((s) => s.id !== id)
        }));
      },

      // Product Actions
      addProduct: (product) => {
        const newProduct = {
          ...product,
          id: Date.now().toString(),
          createdAt: new Date(),
          updatedAt: new Date()
        };

        set((state) => ({
          products: [...state.products, newProduct]
        }));

        return newProduct.id;
      },

      updateProduct: (product) => {
        set((state) => ({
          products: state.products.map((p) => p.id === product.id ? product : p)
        }));
      },

      deleteProduct: (id) => {
        set((state) => ({
          products: state.products.filter((p) => p.id !== id)
        }));
      },

      // Sale Actions
      addSale: (sale) => {
        const newSale = {
          ...sale,
          id: Date.now().toString(),
          createdAt: new Date(),
          updatedAt: new Date()
        };

        set((state) => ({
          sales: [...state.sales, newSale]
        }));

        // Criar comissão automaticamente
        const commission: Omit<Commission, 'id' | 'createdAt' | 'updatedAt'> = {
          saleId: newSale.id,
          sale: newSale,
          instructorId: newSale.instructorId,
          instructor: newSale.instructor,
          amount: newSale.commission,
          status: 'pending'
        };

        get().addCommission(commission);

        return newSale.id;
      },

      updateSale: (sale) => {
        set((state) => ({
          sales: state.sales.map((s) => s.id === sale.id ? sale : s)
        }));
      },

      deleteSale: (id) => {
        set((state) => ({
          sales: state.sales.filter((s) => s.id !== id)
        }));
      },

      // Commission Actions
      addCommission: (commission) => {
        const newCommission = {
          ...commission,
          id: Date.now().toString(),
          createdAt: new Date(),
          updatedAt: new Date()
        };

        set((state) => ({
          commissions: [...state.commissions, newCommission]
        }));

        return newCommission.id;
      },

      updateCommission: (commission) => {
        set((state) => ({
          commissions: state.commissions.map((c) => c.id === commission.id ? commission : c)
        }));
      },

      deleteCommission: (id) => {
        set((state) => ({
          commissions: state.commissions.filter((c) => c.id !== id)
        }));
      },

      // Promotion Actions
      addPromotion: (promotion) => {
        const newPromotion = {
          ...promotion,
          id: Date.now().toString(),
          createdAt: new Date(),
          updatedAt: new Date()
        };

        set((state) => ({
          promotions: [...state.promotions, newPromotion]
        }));

        return newPromotion.id;
      },

      updatePromotion: (promotion) => {
        set((state) => ({
          promotions: state.promotions.map((p) => p.id === promotion.id ? promotion : p)
        }));
      },

      deletePromotion: (id) => {
        set((state) => ({
          promotions: state.promotions.filter((p) => p.id !== id)
        }));
      },

      // Getter Functions
      getStoreById: (id) => {
        const state = get();
        return state.stores.find((s) => s.id === id);
      },

      getStoreProducts: (storeId) => {
        const state = get();
        return state.products.filter((p) => p.storeId === storeId);
      },

      getStoreSales: (storeId) => {
        const state = get();
        return state.sales.filter((s) => s.storeId === storeId);
      },

      getStoreCommissions: (storeId) => {
        const state = get();
        const storeSales = state.sales.filter((s) => s.storeId === storeId);
        const saleIds = storeSales.map((s) => s.id);
        return state.commissions.filter((c) => saleIds.includes(c.saleId));
      },

      getProductPromotions: (productId) => {
        const state = get();
        return state.promotions.filter((p) => p.productId === productId);
      },

      getActivePromotion: (productId) => {
        const state = get();
        const now = new Date();
        return state.promotions.find(
          (p) => 
            p.productId === productId && 
            p.active && 
            p.startDate <= now && 
            p.endDate >= now
        );
      }
    }),
    {
      name: 'kihap-store-storage',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        if (state) {
          return ensureInitialData(state);
        }
        return state;
      }
    }
  )
);
