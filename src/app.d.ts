// See https://kit.svelte.dev/docs/types#app
import type { Patron } from '$lib/server/db';

declare global {
  namespace App {
    interface Locals {
      isAdmin: boolean;
    }
    interface PageData {
      isAdmin?: boolean;
    }
  }
}

export {};
