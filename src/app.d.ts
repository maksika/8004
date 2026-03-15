import type { KVNamespace } from '@cloudflare/workers-types';

declare global {
  namespace App {
    interface Platform {
      env: {
        CACHE: KVNamespace;
        PINATA_JWT: string;
      };
    }
  }
}

export {};
