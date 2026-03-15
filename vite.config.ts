import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  ssr: {
    noExternal: ['viem', '@selfxyz/agent-sdk', 'qrcode', 'socket.io-client'],
  },
});
