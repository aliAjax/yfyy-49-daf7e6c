import { create } from 'zustand';
import api from '../api';
import type { ServiceItem } from '../types';

interface FavoriteState {
  favorites: ServiceItem[];
  favoritedIds: Set<string>;
  loading: boolean;
  loaded: boolean;
  loadFavorites: () => Promise<void>;
  addFavorite: (serviceId: string) => Promise<void>;
  removeFavorite: (serviceId: string) => Promise<void>;
  isFavorited: (serviceId: string) => boolean;
  reset: () => void;
}

export const useFavoriteStore = create<FavoriteState>((set, get) => ({
  favorites: [],
  favoritedIds: new Set<string>(),
  loading: false,
  loaded: false,

  loadFavorites: async () => {
    set({ loading: true });
    try {
      const res: any = await api.get('/service/favorites');
      const items = res.items || [];
      const ids = new Set<string>(items.map((item: ServiceItem) => item.id));
      set({ favorites: items, favoritedIds: ids, loaded: true });
    } catch (error) {
      console.error('加载收藏列表失败:', error);
      set({ favorites: [], favoritedIds: new Set(), loaded: false });
    } finally {
      set({ loading: false });
    }
  },

  addFavorite: async (serviceId: string) => {
    try {
      await api.post(`/service/favorites/${serviceId}`);
      const { favorites, favoritedIds } = get();
      const newFavoritedIds = new Set(favoritedIds);
      newFavoritedIds.add(serviceId);
      set({ favoritedIds: newFavoritedIds });
    } catch (error) {
      console.error('添加收藏失败:', error);
      throw error;
    }
  },

  removeFavorite: async (serviceId: string) => {
    try {
      await api.delete(`/service/favorites/${serviceId}`);
      const { favorites, favoritedIds } = get();
      const newFavorites = favorites.filter((item) => item.id !== serviceId);
      const newFavoritedIds = new Set(favoritedIds);
      newFavoritedIds.delete(serviceId);
      set({ favorites: newFavorites, favoritedIds: newFavoritedIds });
    } catch (error) {
      console.error('取消收藏失败:', error);
      throw error;
    }
  },

  isFavorited: (serviceId: string) => {
    return get().favoritedIds.has(serviceId);
  },

  reset: () => {
    set({ favorites: [], favoritedIds: new Set(), loaded: false });
  },
}));
