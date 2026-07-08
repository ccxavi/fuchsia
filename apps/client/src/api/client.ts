import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';

const API_BASE = 'https://fuchsia-api.giann.dev/api/v1';

let refreshPromise: Promise<string | null> | null = null;

/**
 * Call the backend's /auth/refresh endpoint to swap the stored
 * refresh_token for a fresh access_token + refresh_token pair.
 * Returns the new access_token on success, or null on failure
 * (in which case both tokens are wiped so the app can redirect to login).
 */
async function refreshAccessToken(): Promise<string | null> {
  // If a refresh is already in flight, wait for that one instead of firing another.
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const refreshToken = await SecureStore.getItemAsync('refresh_token');
      if (!refreshToken) return null;

      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!res.ok) {
        // Refresh token is invalid / expired — wipe everything.
        await SecureStore.deleteItemAsync('access_token');
        await SecureStore.deleteItemAsync('refresh_token');
        return null;
      }

      const data = await res.json();
      const newAccessToken: string | null = data.access_token ?? null;
      const newRefreshToken: string | null = data.refresh_token ?? null;

      if (newAccessToken) {
        await SecureStore.setItemAsync('access_token', newAccessToken);
      }
      if (newRefreshToken) {
        await SecureStore.setItemAsync('refresh_token', newRefreshToken);
      }

      return newAccessToken;
    } catch {
      // Network error during refresh — wipe tokens to be safe.
      await SecureStore.deleteItemAsync('access_token');
      await SecureStore.deleteItemAsync('refresh_token');
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// ── Generic request helper ──────────────────────────────────────────

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  _isRetry = false,
): Promise<T> {
  const token = await SecureStore.getItemAsync('access_token');

  const isFormData = options.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    'Cache-Control': 'no-cache',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> ?? {}),
  };

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  // If we got a 401 and haven't retried yet, attempt a silent token refresh.
  if (res.status === 401 && !_isRetry) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      // Retry the original request with the fresh token.
      return apiFetch<T>(path, options, true);
    }
    // Refresh failed — fall through to the error below.
  }

  if (!res.ok) {
    if (res.status === 401) {
      router.replace('/welcome');
    }
    const body = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${body}`);
  }

  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

// ── Auth / Profile ─────────────────────────────────────────────────────────

export type AuthenticatedUserResponse = {
  id: string;
  supabase_user_id: string;
  email: string | null;
  display_name: string | null;
  created_at: string;
  updated_at: string;
};

export type AuthMeResponse = {
  user: AuthenticatedUserResponse;
};

export async function getMe(): Promise<AuthMeResponse> {
  return apiFetch<AuthMeResponse>('/auth/me');
}

export type UserPreferencesUpdateRequest = {
  display_name?: string | null;
};

export async function updateProfile(payload: UserPreferencesUpdateRequest): Promise<AuthMeResponse> {
  return apiFetch<AuthMeResponse>('/auth/me', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

// ── Closet / Wardrobe ─────────────────────────────────────────────────────────

export type WardrobeResponse = {
  id: string;
  user_id: string;
  name: string;
  clothing_items_count: number;
  outfits_count: number;
  image_url?: string | null;
  created_at: string;
  updated_at: string;
};

export type OutfitResponse = {
  id: string;
  user_id: string;
  name: string;
  is_ai_generated: boolean;
  image_url?: string | null;
  clothing_items_count: number;
  wardrobes_count: number;
  created_at: string;
  updated_at: string;
};

export type OutfitImageResponse = {
  id: string;
  outfit_id: string;
  image_url: string;
  date: string | null;
  created_at: string;
};

export type OutfitWithItemsResponse = OutfitResponse & {
  clothing_items: ClothingItemResponse[];
  images?: OutfitImageResponse[];
};

export type OutfitWithWardrobesResponse = OutfitWithItemsResponse & {
  wardrobes: WardrobeResponse[];
};

export type WardrobeWithDetailsResponse = WardrobeResponse & {
  clothing_items: ClothingItemResponse[];
  outfits: OutfitWithItemsResponse[];
};

export async function getWardrobes(): Promise<WardrobeResponse[]> {
  return apiFetch<WardrobeResponse[]>('/wardrobes');
}

export async function getWardrobe(id: string): Promise<WardrobeWithDetailsResponse> {
  return apiFetch<WardrobeWithDetailsResponse>(`/wardrobes/${id}`);
}

export async function getWardrobeClothingItems(wardrobeId: string): Promise<ClothingItemResponse[]> {
  return apiFetch<ClothingItemResponse[]>(`/wardrobes/${wardrobeId}/clothing-items`);
}

export type WardrobeCreateRequest = {
  name: string;
  quantity?: number;
  imageUri?: string;
};

export async function createWardrobe(data: WardrobeCreateRequest): Promise<WardrobeResponse> {
  const formData = new FormData();
  formData.append('name', data.name);
  
  if (data.quantity !== undefined) {
    formData.append('quantity', String(data.quantity));
  }

  if (data.imageUri) {
    const filename = data.imageUri.split('/').pop() || 'image.jpg';
    const match = /\.(\w+)$/.exec(filename);
    let type = 'image/jpeg';
    if (match) {
      const ext = match[1].toLowerCase();
      if (ext === 'jpg') type = 'image/jpeg';
      else type = `image/${ext}`;
    }
    // @ts-ignore
    formData.append('image', { uri: data.imageUri, name: filename, type });
  }

  return apiFetch<WardrobeResponse>('/wardrobes/', {
    method: 'POST',
    body: formData,
  });
}

export type WardrobeUpdateRequest = {
  name?: string;
  quantity?: number;
  imageUri?: string;
};

export async function updateWardrobe(id: string, data: WardrobeUpdateRequest): Promise<WardrobeResponse> {
  const formData = new FormData();
  if (data.name !== undefined) formData.append('name', data.name);
  if (data.quantity !== undefined) formData.append('quantity', String(data.quantity));

  if (data.imageUri) {
    const filename = data.imageUri.split('/').pop() || 'image.jpg';
    const match = /\.(\w+)$/.exec(filename);
    let type = 'image/jpeg';
    if (match) {
      const ext = match[1].toLowerCase();
      if (ext === 'jpg') type = 'image/jpeg';
      else type = `image/${ext}`;
    }
    // @ts-ignore
    formData.append('image', { uri: data.imageUri, name: filename, type });
  }

  return apiFetch<WardrobeResponse>(`/wardrobes/${id}`, {
    method: 'PATCH',
    body: formData,
  });
}

export async function deleteWardrobe(id: string): Promise<void> {
  return apiFetch<void>(`/wardrobes/${id}`, {
    method: 'DELETE',
  });
}

export type ClothingItemResponse = {
  id: string;
  user_id: string;
  name: string;
  category: string | null;
  color: string | null;
  brand: string | null;
  image_url: string | null;
  is_favorite: boolean;
  wardrobes_count: number;
  outfits_count: number;
  created_at: string;
  updated_at: string;
};

export type ClothingItemWithWardrobesResponse = ClothingItemResponse & {
  wardrobes: WardrobeResponse[];
};

export async function getClothingItems(): Promise<ClothingItemResponse[]> {
  return apiFetch<ClothingItemResponse[]>('/clothing-items');
}

export async function getClothingItem(id: string): Promise<ClothingItemWithWardrobesResponse> {
  return apiFetch<ClothingItemWithWardrobesResponse>(`/clothing-items/${id}`);
}

export async function deleteClothingItem(id: string): Promise<void> {
  return apiFetch<void>(`/clothing-items/${id}`, {
    method: 'DELETE',
  });
}

export type ClothingItemCreateRequest = {
  name: string;
  category?: string;
  color?: string;
  brand?: string;
  wardrobe_ids?: string[];
  imageUri?: string;
};

export async function createClothingItem(data: ClothingItemCreateRequest): Promise<ClothingItemResponse> {
  const formData = new FormData();
  formData.append('name', data.name);
  if (data.category) formData.append('category', data.category);
  if (data.color) formData.append('color', data.color);
  if (data.brand) formData.append('brand', data.brand);
  
  if (data.wardrobe_ids && data.wardrobe_ids.length > 0) {
    data.wardrobe_ids.forEach(id => formData.append('wardrobe_ids', id));
  }

  if (data.imageUri) {
    const filename = data.imageUri.split('/').pop() || 'image.jpg';
    const match = /\.(\w+)$/.exec(filename);
    let type = 'image/jpeg';
    if (match) {
      const ext = match[1].toLowerCase();
      if (ext === 'jpg') type = 'image/jpeg';
      else type = `image/${ext}`;
    }
    // @ts-ignore - React Native FormData expects this format for files
    formData.append('image', { uri: data.imageUri, name: filename, type });
  }

  return apiFetch<ClothingItemResponse>('/clothing-items/', {
    method: 'POST',
    body: formData,
  });
}

export type ClothingItemUpdateRequest = {
  name?: string;
  category?: string;
  color?: string;
  brand?: string;
  is_favorite?: boolean;
  wardrobe_ids?: string[];
  imageUri?: string;
};

export async function updateClothingItem(id: string, data: ClothingItemUpdateRequest): Promise<ClothingItemResponse> {
  const formData = new FormData();
  if (data.name !== undefined) formData.append('name', data.name);
  if (data.category !== undefined) formData.append('category', data.category);
  if (data.color !== undefined) formData.append('color', data.color);
  if (data.brand !== undefined) formData.append('brand', data.brand);
  if (data.is_favorite !== undefined) formData.append('is_favorite', String(data.is_favorite));

  if (data.wardrobe_ids !== undefined) {
    if (data.wardrobe_ids.length === 0) {
      formData.append('wardrobe_ids', '');
    } else {
      data.wardrobe_ids.forEach(id => formData.append('wardrobe_ids', id));
    }
  }

  if (data.imageUri) {
    const filename = data.imageUri.split('/').pop() || 'image.jpg';
    const match = /\.(\w+)$/.exec(filename);
    let type = 'image/jpeg';
    if (match) {
      const ext = match[1].toLowerCase();
      if (ext === 'jpg') type = 'image/jpeg';
      else type = `image/${ext}`;
    }
    // @ts-ignore
    formData.append('image', { uri: data.imageUri, name: filename, type });
  }

  return apiFetch<ClothingItemResponse>(`/clothing-items/${id}`, {
    method: 'PATCH',
    body: formData,
  });
}

export async function addItemToWardrobe(itemId: string, wardrobeId: string): Promise<ClothingItemResponse> {
  return apiFetch<ClothingItemResponse>(`/clothing-items/${itemId}/wardrobes/${wardrobeId}`, {
    method: 'POST',
  });
}

export async function removeItemFromWardrobe(itemId: string, wardrobeId: string): Promise<void> {
  return apiFetch<void>(`/clothing-items/${itemId}/wardrobes/${wardrobeId}`, {
    method: 'DELETE',
  });
}

// ── Outfit API ──────────────────────────────────────────────────────────────

export async function getOutfits(): Promise<OutfitWithItemsResponse[]> {
  return apiFetch<OutfitWithItemsResponse[]>('/outfits');
}

export async function getOutfit(id: string): Promise<OutfitWithWardrobesResponse> {
  return apiFetch<OutfitWithWardrobesResponse>(`/outfits/${id}`);
}

export type OutfitCreateRequest = {
  name: string;
  clothing_item_ids?: string[];
  wardrobe_ids?: string[];
  imageUri?: string;
};

export async function createOutfit(data: OutfitCreateRequest): Promise<OutfitResponse> {
  const formData = new FormData();
  formData.append('name', data.name);

  if (data.clothing_item_ids && data.clothing_item_ids.length > 0) {
    data.clothing_item_ids.forEach(id => formData.append('clothing_item_ids', id));
  }

  if (data.wardrobe_ids && data.wardrobe_ids.length > 0) {
    data.wardrobe_ids.forEach(id => formData.append('wardrobe_ids', id));
  }

  if (data.imageUri) {
    const filename = data.imageUri.split('/').pop() || 'image.jpg';
    const match = /\.(\w+)$/.exec(filename);
    let type = 'image/jpeg';
    if (match) {
      const ext = match[1].toLowerCase();
      if (ext === 'jpg') type = 'image/jpeg';
      else type = `image/${ext}`;
    }
    // @ts-ignore
    formData.append('image', { uri: data.imageUri, name: filename, type });
  }

  return apiFetch<OutfitResponse>('/outfits', {
    method: 'POST',
    body: formData,
  });
}

export type OutfitUpdateRequest = {
  name?: string;
  wardrobe_ids?: string[];
  imageUri?: string;
};

export async function updateOutfit(id: string, data: OutfitUpdateRequest): Promise<OutfitResponse> {
  const formData = new FormData();
  if (data.name !== undefined) formData.append('name', data.name);

  if (data.wardrobe_ids !== undefined) {
    if (data.wardrobe_ids.length === 0) {
      formData.append('wardrobe_ids', '');
    } else {
      data.wardrobe_ids.forEach(id => formData.append('wardrobe_ids', id));
    }
  }

  if (data.imageUri) {
    const filename = data.imageUri.split('/').pop() || 'image.jpg';
    const match = /\.(\w+)$/.exec(filename);
    let type = 'image/jpeg';
    if (match) {
      const ext = match[1].toLowerCase();
      if (ext === 'jpg') type = 'image/jpeg';
      else type = `image/${ext}`;
    }
    // @ts-ignore
    formData.append('image', { uri: data.imageUri, name: filename, type });
  }

  return apiFetch<OutfitResponse>(`/outfits/${id}`, {
    method: 'PATCH',
    body: formData,
  });
}

export async function deleteOutfit(id: string): Promise<void> {
  return apiFetch<void>(`/outfits/${id}`, {
    method: 'DELETE',
  });
}

export async function addItemToOutfit(outfitId: string, clothingItemId: string): Promise<OutfitWithItemsResponse> {
  const formData = new FormData();
  formData.append('clothing_item_id', clothingItemId);
  return apiFetch<OutfitWithItemsResponse>(`/outfits/${outfitId}/items`, {
    method: 'POST',
    body: formData,
  });
}

export async function removeItemFromOutfit(outfitId: string, itemId: string): Promise<OutfitWithItemsResponse> {
  return apiFetch<OutfitWithItemsResponse>(`/outfits/${outfitId}/items/${itemId}`, {
    method: 'DELETE',
  });
}

export async function addWardrobeToOutfit(outfitId: string, wardrobeId: string): Promise<OutfitWithWardrobesResponse> {
  return apiFetch<OutfitWithWardrobesResponse>(`/outfits/${outfitId}/wardrobes/${wardrobeId}`, {
    method: 'POST',
  });
}

export async function removeWardrobeFromOutfit(outfitId: string, wardrobeId: string): Promise<OutfitWithWardrobesResponse> {
  return apiFetch<OutfitWithWardrobesResponse>(`/outfits/${outfitId}/wardrobes/${wardrobeId}`, {
    method: 'DELETE',
  });
}

export async function deleteOutfitImage(imageId: string): Promise<void> {
  return apiFetch<void>(`/outfits/images/${imageId}`, {
    method: 'DELETE',
  });
}

// ==========================================
// CALENDAR OUTFITS
// ==========================================

export type CalendarOutfitResponse = {
  id: string;
  user_id: string;
  outfit_id: string;
  date: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type CalendarOutfitWithOutfitResponse = CalendarOutfitResponse & {
  outfit: OutfitWithItemsResponse;
  // Day images can be ignored for now unless needed
};

export type CalendarOutfitCreateRequest = {
  outfit_id: string;
  date: string; // YYYY-MM-DD
  notes?: string;
};

export type CalendarOutfitUpdateRequest = {
  date?: string; // YYYY-MM-DD
  notes?: string;
};

export async function createCalendarOutfit(data: CalendarOutfitCreateRequest): Promise<CalendarOutfitResponse> {
  return apiFetch<CalendarOutfitResponse>('/calendar/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
}

export async function getCalendarOutfits(year?: number, month?: number): Promise<CalendarOutfitWithOutfitResponse[]> {
  const queryParams = new URLSearchParams();
  if (year !== undefined) queryParams.append('year', year.toString());
  if (month !== undefined) queryParams.append('month', month.toString());
  
  const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';
  return apiFetch<CalendarOutfitWithOutfitResponse[]>(`/calendar/${queryString}`);
}

export async function updateCalendarOutfit(id: string, data: CalendarOutfitUpdateRequest): Promise<CalendarOutfitResponse> {
  return apiFetch<CalendarOutfitResponse>(`/calendar/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
}

export async function deleteCalendarOutfit(id: string): Promise<void> {
  return apiFetch<void>(`/calendar/${id}`, {
    method: 'DELETE',
  });
}
