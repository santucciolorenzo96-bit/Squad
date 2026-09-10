import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'url';

// Due pagine: la nuova interfaccia (index.html), che e' l'app, e quella
// precedente (classica.html), che resta raggiungibile finche' serve una via di
// ritorno. Condividono state, API e utilita': quello che cambia e' la
// presentazione, non il funzionamento.
//
// __dirname non esiste qui: package.json dichiara "type": "module", quindi il
// percorso si ricava dall'URL del modulo.
const qui = (p) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173
  },
  build: {
    rollupOptions: {
      input: {
        main: qui('./index.html'),
        classica: qui('./classica.html')
      }
    }
  }
});
