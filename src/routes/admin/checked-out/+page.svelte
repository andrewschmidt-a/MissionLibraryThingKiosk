<script lang="ts">
  import { enhance } from '$app/forms';
  let { data, form } = $props();

  function fmtPhone(d: string): string {
    const x = (d ?? '').replace(/\D+/g, '');
    if (x.length === 10) return `(${x.slice(0, 3)}) ${x.slice(3, 6)}-${x.slice(6)}`;
    return d;
  }
  function fmtDate(iso: string): string {
    try {
      return new Date(iso.replace(' ', 'T') + 'Z').toLocaleString();
    } catch {
      return iso;
    }
  }
</script>

<svelte:head><title>Checked Out</title></svelte:head>

<div class="flex items-center justify-between mb-4">
  <h1 class="text-2xl font-semibold">Currently Checked Out ({data.rows.length})</h1>
  <form method="GET" class="flex gap-2">
    <input
      class="input"
      name="q"
      placeholder="Search title, author, patron, phone, barcode"
      value={data.q}
    />
    <button class="btn-secondary">Search</button>
  </form>
</div>

{#if form?.success}
  <div class="card border-2 border-emerald-300 bg-emerald-50 mb-4 text-emerald-800">{form.message}</div>
{/if}
{#if form?.error}
  <div class="card border-2 border-rose-300 bg-rose-50 mb-4 text-rose-800">{form.error}</div>
{/if}

<div class="card overflow-x-auto p-0">
  <table class="min-w-full text-sm">
    <thead class="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-600">
      <tr>
        <th class="px-4 py-2">Title</th>
        <th class="px-4 py-2">Author</th>
        <th class="px-4 py-2">Barcode</th>
        <th class="px-4 py-2">Patron</th>
        <th class="px-4 py-2">Phone</th>
        <th class="px-4 py-2">Checked out</th>
        <th class="px-4 py-2"></th>
      </tr>
    </thead>
    <tbody class="divide-y divide-slate-200">
      {#each data.rows as r}
        <tr>
          <td class="px-4 py-2 font-medium">{r.title}</td>
          <td class="px-4 py-2 text-slate-600">{r.primary_author ?? ''}</td>
          <td class="px-4 py-2 font-mono text-xs">{r.barcode ?? '—'}</td>
          <td class="px-4 py-2">{[r.patron_first, r.patron_last].filter(Boolean).join(' ') || '—'}</td>
          <td class="px-4 py-2">{fmtPhone(r.phone)}</td>
          <td class="px-4 py-2 text-slate-600">{fmtDate(r.checked_out_at)}</td>
          <td class="px-4 py-2 text-right">
            <form method="POST" action="?/checkin" use:enhance>
              <input type="hidden" name="checkout_id" value={r.checkout_id} />
              <button class="btn-secondary">Check in</button>
            </form>
          </td>
        </tr>
      {:else}
        <tr><td colspan="7" class="px-4 py-6 text-center text-slate-500">No items currently checked out.</td></tr>
      {/each}
    </tbody>
  </table>
</div>
