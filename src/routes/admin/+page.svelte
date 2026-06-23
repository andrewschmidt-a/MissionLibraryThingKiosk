<script lang="ts">
  let { data } = $props();
  const c = data.counts;
</script>

<svelte:head><title>Admin Dashboard</title></svelte:head>

<h1 class="text-2xl font-semibold mb-6">Dashboard</h1>

<div class="grid grid-cols-2 md:grid-cols-4 gap-4">
  <div class="card"><div class="text-sm text-slate-500">Books</div><div class="text-3xl font-bold">{c.books}</div></div>
  <div class="card"><div class="text-sm text-slate-500">Copies</div><div class="text-3xl font-bold">{c.copies}</div></div>
  <div class="card"><div class="text-sm text-slate-500">Patrons</div><div class="text-3xl font-bold">{c.patrons}</div></div>
  <div class="card"><div class="text-sm text-slate-500">Currently checked out</div><div class="text-3xl font-bold">{c.active_checkouts}</div></div>
</div>

<div class="card mt-6">
  <h2 class="text-lg font-medium">Catalog health</h2>
  <ul class="mt-3 space-y-1 text-sm text-slate-700">
    <li>Copies with explicit barcodes: <b>{c.copies_explicit}</b></li>
    <li>Copies using ISBN-derived barcodes: <b>{c.copies_isbn}</b></li>
    <li>Copies missing a barcode (not scannable): <b>{c.copies_no_barcode}</b></li>
  </ul>
  <div class="mt-4 flex gap-2">
    <a class="btn-primary" href="/admin/catalog">Replace Catalog</a>
    <a class="btn-secondary" href="/admin/checked-out">View Checked Out</a>
    <a class="btn-secondary" href="/admin/check-in">Check In</a>
  </div>
</div>
