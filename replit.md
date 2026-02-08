# Estoque Pro

## Overview

Estoque Pro is a mobile inventory management application built with React Native (Expo) and an Express backend. The app is designed for small businesses to track products, categories, stock movements (entries/exits), and low-stock alerts. The UI is in Brazilian Portuguese.

The app follows a hybrid architecture: the mobile frontend uses local storage (AsyncStorage) for data persistence, while a backend Express server with PostgreSQL (via Drizzle ORM) is set up but not yet fully integrated with the frontend. The current data flow is entirely client-side through AsyncStorage.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend (React Native / Expo)

- **Framework**: Expo SDK 54 with Expo Router v6 (file-based routing)
- **Navigation**: Tab-based layout with 4 main tabs (Dashboard/Painel, Products/Produtos, Movements/Movimentações, Alerts/Alertas), plus modal screens for adding/editing products and movements
- **State Management**: Local component state with `useState` and `useFocusEffect` for data refresh. React Query (`@tanstack/react-query`) is configured in the query client but not heavily used yet — data fetching is primarily through AsyncStorage helpers
- **Data Storage (Current)**: All product, category, and movement data is stored locally via `@react-native-async-storage/async-storage` with helper functions in `lib/storage.ts`
- **Fonts**: Inter font family (400, 500, 600, 700 weights) via `@expo-google-fonts/inter`
- **UI Components**: Custom components using React Native primitives, Ionicons for icons, `expo-haptics` for tactile feedback, `expo-blur` and `expo-glass-effect` for visual effects
- **Keyboard Handling**: `react-native-keyboard-controller` with a cross-platform `KeyboardAwareScrollViewCompat` wrapper
- **Color Scheme**: Teal-based color palette defined in `constants/colors.ts` with primary color `#0D9488`

### File Structure

- `app/` — Expo Router pages (file-based routing)
  - `(tabs)/` — Main tab screens (index, products, movements, alerts)
  - `product/` — Product detail, add, and edit screens
  - `movement/` — Movement add screen
  - `categories.tsx` — Category management screen
- `components/` — Reusable components (ErrorBoundary, ErrorFallback, KeyboardAwareScrollView)
- `constants/` — App constants (colors)
- `lib/` — Utility modules
  - `storage.ts` — AsyncStorage-based CRUD operations for products, categories, movements
  - `query-client.ts` — React Query client and API request helpers
- `server/` — Express backend
- `shared/` — Shared types and schemas (Drizzle ORM schema)
- `scripts/` — Build scripts for static web export

### Backend (Express)

- **Framework**: Express v5 running on Node.js
- **Purpose**: Currently serves as an API server shell with CORS configuration. Routes are registered in `server/routes.ts` but no application routes are defined yet
- **Database Schema**: Defined in `shared/schema.ts` using Drizzle ORM with PostgreSQL dialect. Currently only has a `users` table
- **Storage Layer**: `server/storage.ts` has an in-memory storage implementation (`MemStorage`) for users, with an `IStorage` interface designed for swapping implementations
- **CORS**: Configured to allow Replit dev domains and localhost origins

### Data Models (Client-Side in `lib/storage.ts`)

- **Category**: id, name, color — comes with 6 default categories
- **Product**: id, name, categoryId, quantity, minStock, price, unit, createdAt, updatedAt
- **Movement**: id, productId, type (entry/exit), quantity, note, createdAt

### Key Architectural Decisions

1. **Local-first data with AsyncStorage**: All inventory data lives on the device. This means the app works offline but data doesn't sync across devices. The backend/database infrastructure exists but isn't wired to the frontend yet.

2. **Expo Router for navigation**: File-based routing provides a clear mapping between files and screens. Modal presentations are used for add/edit forms.

3. **Separate server process**: The Express server runs independently (`server:dev` script) from the Expo dev server. In production, the server can serve a static web build of the app.

4. **Drizzle ORM with PostgreSQL**: The database schema is defined but minimal (only users table). The inventory models (products, categories, movements) exist only in the client-side storage module and would need to be migrated to server-side Drizzle schemas for full backend integration.

### Build & Development

- `npm run expo:dev` — Start Expo development server
- `npm run server:dev` — Start Express backend with tsx
- `npm run db:push` — Push Drizzle schema to PostgreSQL
- `npm run expo:static:build` — Build static web export
- `npm run server:prod` — Run production server (serves static build)

## External Dependencies

- **PostgreSQL**: Required for the backend (Drizzle ORM). Connection string via `DATABASE_URL` environment variable. Currently only has a users table schema
- **AsyncStorage**: Client-side persistent storage for all inventory data (products, categories, movements)
- **Expo Services**: Standard Expo SDK services (fonts, haptics, image picker, location, splash screen, etc.)
- **React Query**: Configured for API data fetching with `expo/fetch`, base URL derived from `EXPO_PUBLIC_DOMAIN` environment variable
- **Drizzle Kit**: Database migration tool, configured in `drizzle.config.ts`
- **Environment Variables**:
  - `DATABASE_URL` — PostgreSQL connection string (required for backend/migrations)
  - `REPLIT_DEV_DOMAIN` — Used for CORS and Expo proxy configuration
  - `EXPO_PUBLIC_DOMAIN` — Used by the client to construct API URLs