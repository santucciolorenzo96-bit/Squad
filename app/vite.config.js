import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'url';

// Due pagine: l'app attuale (index.html) e l'anteprima della nuova interfaccia
// (anteprima.html). Convivono nella stessa build e condividono state, API e
// utilita': l'anteprima ridisegna la presentazione, non rifa' il funzionamento.
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
        anteprima: qui('./anteprima.html')
      }
    }
  }
});
