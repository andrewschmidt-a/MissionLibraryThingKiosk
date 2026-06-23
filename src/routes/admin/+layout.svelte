<script lang="ts">
  import { page } from '$app/state';
  let { children, data } = $props();
  const nav = [
    { href: '/admin', label: 'Dashboard' },
    { href: '/admin/catalog', label: 'Replace Catalog' },
    { href: '/admin/checked-out', label: 'Checked Out' },
    { href: '/admin/check-in', label: 'Check In' }
  ];
</script>

<div class="min-h-screen">
  <header class="bg-slate-900 text-white">
    <div class="mx-auto max-w-6xl px-6 py-3 flex items-center justify-between">
      <a href="/admin" class="font-semibold">Library Admin</a>
      {#if data?.isAdmin}
        <nav class="flex gap-1 text-sm">
          {#each nav as item}
            <a
              href={item.href}
              class="px-3 py-1.5 rounded-md hover:bg-slate-700 {page.url.pathname === item.href ? 'bg-slate-700' : ''}"
            >
              {item.label}
            </a>
          {/each}
          <form method="POST" action="/admin/login?/logout" class="ml-2">
            <button class="px-3 py-1.5 rounded-md hover:bg-slate-700">Sign out</button>
          </form>
        </nav>
      {/if}
      <a href="/" class="text-sm text-slate-300 hover:text-white">← Kiosk</a>
    </div>
  </header>
  <main class="mx-auto max-w-6xl p-6">
    {@render children()}
  </main>
</div>
