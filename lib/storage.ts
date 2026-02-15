import { Platform } from "react-native";
import * as Crypto from "expo-crypto";

/* =========================
   TIPAGENS
========================= */

export interface Category {
  id: string;
  name: string;
  color: string;
}

export interface Product {
  id: string;
  name: string;
  categoryId: string;
  quantity: number;
  minStock: number;
  price: string | number;
  unit: string;
  createdAt: string;
  updatedAt: string;
}

export interface Movement {
  id: string;
  productId: string;
  type: "entry" | "exit";
  quantity: number;
  note: string | null;
  createdAt: string;
}

/* =========================
   CONFIGURAÇÃO DE API
========================= */

// URL do backend (vem do .env)
const API_BASE = process.env.EXPO_PUBLIC_API_URL;

if (!API_BASE) {
  console.error("EXPO_PUBLIC_API_URL não definida no .env");
}

/* =========================
   FUNÇÃO BASE DE REQUEST
========================= */

async function apiRequest(path: string, options: RequestInit = {}) {
  const url = `${API_BASE}/api${path}`;

  console.log("Chamando API:", url);

  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: "Erro desconhecido" }));

    throw new Error(error.message || "Erro na requisição");
  }

  if (response.status === 204) return null;

  return response.json();
}

/* =========================
   CATEGORIES
========================= */

export async function getCategories(): Promise<Category[]> {
  return apiRequest("/categories");
}

export async function addCategory(
  name: string,
  color: string
): Promise<Category> {
  const id = Crypto.randomUUID();

  return apiRequest("/categories", {
    method: "POST",
    body: JSON.stringify({ id, name, color }),
  });
}

export async function updateCategory(
  id: string,
  data: Partial<Omit<Category, "id">>
): Promise<Category> {
  return apiRequest(`/categories/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteCategory(id: string): Promise<void> {
  return apiRequest(`/categories/${id}`, {
    method: "DELETE",
  });
}

/* =========================
   PRODUCTS
========================= */

export async function getProducts(): Promise<Product[]> {
  return apiRequest("/products");
}

export async function getProduct(
  id: string
): Promise<Product | undefined> {
  const products = await getProducts();
  return products.find((p) => p.id === id);
}

export async function addProduct(
  data: Omit<Product, "id" | "createdAt" | "updatedAt">
): Promise<Product> {
  const id = Crypto.randomUUID();

  return apiRequest("/products", {
    method: "POST",
    body: JSON.stringify({ ...data, id }),
  });
}

export async function updateProduct(
  id: string,
  data: Partial<Omit<Product, "id" | "createdAt">>
): Promise<Product> {
  return apiRequest(`/products/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteProduct(id: string): Promise<void> {
  return apiRequest(`/products/${id}`, {
    method: "DELETE",
  });
}

/* =========================
   MOVEMENTS
========================= */

export async function getMovements(): Promise<Movement[]> {
  return apiRequest("/movements");
}

export async function addMovement(
  data: Omit<Movement, "id" | "createdAt">
): Promise<Movement> {
  const id = Crypto.randomUUID();

  return apiRequest("/movements", {
    method: "POST",
    body: JSON.stringify({ ...data, id }),
  });
}

/* =========================
   BACKUP
========================= */

export interface BackupData {
  version: number;
  exportedAt: string;
  categories: Category[];
  products: Product[];
  movements: Movement[];
}

export async function exportAllData(): Promise<BackupData> {
  const [categories, products, movements] = await Promise.all([
    getCategories(),
    getProducts(),
    getMovements(),
  ]);

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    categories,
    products,
    movements,
  };
}

export async function importAllData(data: BackupData): Promise<void> {
  for (const cat of data.categories) {
    await addCategory(cat.name, cat.color);
  }

  for (const prod of data.products) {
    await addProduct({
      name: prod.name,
      categoryId: prod.categoryId,
      quantity: prod.quantity,
      minStock: prod.minStock,
      price: prod.price,
      unit: prod.unit,
    });
  }
}

export async function clearAllData(): Promise<void> {
  // Implementar se necessário
}
