import { create } from 'zustand';
import api from '../api';
import type { ServiceItem } from '../types';

interface FavoriteState {
  favoriteServices: ServiceItem[];
  favoriteIds: string[];
  loading: boolean;
  loadFavorites: () => Promise<void>;
  isFavorite: (serviceItemId: string) => boolean;
  setFavorite: (serviceItemId: string, favorite: boolean) => Promise<void>;
  clearFavorites: () => void;
}

export const useFavoriteStore = create<FavoriteState>((set, get) => ({
  favoriteServices: [],
  favoriteIds: [],
  loading: false,

  loadFavorites: async () => {
    set({ loading: true });
    try {
      const res: any = await api.get('/service/favorites');
      const items = res.items || [];
      set({
        favoriteServices: items,
        favoriteIds: items.map((item: ServiceItem) => item.id),
      });
    } finally {
      set({ loading: false });
    }
  },

  isFavorite: (serviceItemId: string) => get().favoriteIds.includes(serviceItemId),

  setFavorite: async (serviceItemId: string, favorite: boolean) => {
    if (favorite) {
      await api.post(`/service/favorites/${serviceItemId}`);
    } else {
      await api.delete(`/service/favorites/${serviceItemId}`);
    }
    await get().loadFavorites();
  },

  clearFavorites: () => set({ favoriteServices: [], favoriteIds: [], loading: false }),
}));
