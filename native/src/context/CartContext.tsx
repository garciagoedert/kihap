import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface CartItem {
  cartId: string;
  id: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl: string;
  totalAmount: number;
}

interface CartContextType {
  items: CartItem[];
  addItem: (product: any, quantity: number) => void;
  removeItem: (cartId: string) => void;
  clearCart: () => void;
  total: number;
  itemCount: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    loadCart();
  }, []);

  const loadCart = async () => {
    try {
      const cartData = await AsyncStorage.getItem('kihap_cart');
      if (cartData) {
        setItems(JSON.parse(cartData));
      }
    } catch (error) {
      console.error('Error loading cart:', error);
    }
  };

  const saveCart = async (newItems: CartItem[]) => {
    try {
      await AsyncStorage.setItem('kihap_cart', JSON.stringify(newItems));
    } catch (error) {
      console.error('Error saving cart:', error);
    }
  };

  const addItem = (item: any, quantity: number) => {
    const cartId = Date.now().toString() + Math.random().toString(36).substr(2, 5);
    const newItem: CartItem = {
      cartId,
      ...item,
      quantity
    };

    const newItems = [...items, newItem];
    setItems(newItems);
    saveCart(newItems);
  };

  const removeItem = (cartId: string) => {
    const newItems = items.filter(item => item.cartId !== cartId);
    setItems(newItems);
    saveCart(newItems);
  };

  const clearCart = () => {
    setItems([]);
    saveCart([]);
  };

  const total = items.reduce((sum, item) => sum + item.totalAmount, 0);
  const itemCount = items.length;

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, clearCart, total, itemCount }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
