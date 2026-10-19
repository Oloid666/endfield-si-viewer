import { defineConfig } from 'vite';

// Actions supplies /repository/; relative assets also work in a nested preview.
export default defineConfig({ base: process.env.VITE_BASE_PATH || './' });
