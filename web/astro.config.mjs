// Configuracion estatica: sin adaptadores de servidor ni SSR.
// El build no debe depender de que la API este viva.
import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  server: {
    port: 4321,
    host: true,
  },
});
