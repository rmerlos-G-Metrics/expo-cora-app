EXPO-CORA-APP
├── app/ # UI screens and navigation (Expo Router)
├── assets/
├── components/ # Reusable UI elements (Buttons, Cards, Modals)
├── constants/ # App-wide constants (Theme colors, API endpoints)
├── hooks/ # Custom React Hooks (e.g., useBLE.ts, useFetch.ts)
│
├── services/ # Pure JS/TS logic for Bluetooth & API communication
│ ├── bleManager.ts # Initialization, scanning, and connecting to BLE
│ └── api.ts # Axios/Fetch setup, interceptors, and HTTP POST definitions
│
├── store/ # Global state management (Zustand, Redux, or Context)
│ └── useAppStore.ts # To share data between BLE events, HTTP calls, and the UI
│
└── ...other existing files
