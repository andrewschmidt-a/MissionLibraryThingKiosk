<script lang="ts">
  import { enhance } from '$app/forms';
  import { tick } from 'svelte';

  let { form }: { form: any } = $props();

  let showConfirm = $state(false);
  let applyFormEl: HTMLFormElement | null = $state(null);

  const plan = $derived(form?.plan as
    | {
        add: Array<{ id: string; title: string; primary_author: string | null; copies: number; bySource: { explicit: number; isbn: number; none: number } }>;
        update: Array<{
          id: string;
          title: string;
          primary_author: string | null;
          fieldsChanged: string[];
          copiesToAdd: Array<{ barcode: string | null; source: string; hasActiveCheckout: boolean }>;
          copiesToRemove: Array<{ barcode: string | null; source: string; hasActiveCheckout: boolean }>;
        }>;
        delete: Array<{ id: string; title: string; primary_author: string | null; copies: number; activeCheckouts: number }>;
        totals: {
          booksAdded: number;
          booksUpdated: number;
          booksRemoved: number;
          booksWithActiveBlockingDelete: number;
          copiesAdded: number;
          copiesRemoved: number;
          copiesRemovedWithActive: number;
          bySource: { explicit: number; isbn: number; none: number };
        };
      }
    | undefined);

  const summary = $derived(form?.summary);

  const needsConfirm = $derived(
    !!plan && (plan.totals.copiesRemovedWithActive > 0 || plan.totals.booksWithActiveBlockingDelete > 0)
  );

  function onApplyClick(e: MouseEvent) {
    if (needsConfirm) {
      e.preventDefault();
      showConfirm = true;
    }
  }

  function confirmAndSubmit() {
    showConfirm = false;
    tick().then(() => applyFormEl?.requestSubmit());
  }

  function formatBarcode(b: string | null): string {
    if (b === null) return '(no barcode)';
    if (b.startsWith('_isbn_')) return `${b}  ·  ISBN-derived`;
    return b;
  }
</script>

<svelte:head><title>Replace Catalog</title></svelte:head>

<h1 class="text-2xl font-semibold mb-4">Replace Catalog</h1>

{#if summary}
  <div class="card border-2 border-emerald-300 bg-emerald-50 mb-4">
    <h2 class="text-lg font-medium text-emerald-900">Import applied</h2>
    <div class="mt-3 grid grid-cols-2 md:grid-cols-3 gap-3 text-sm text-emerald-900">
      <div>Books added: <b>{summary.booksAdded}</b></div>
      <div>Books updated: <b>{summary.booksUpdated}</b></div>
      <div>Books removed: <b>{summary.booksRemoved}</b></div>
      <div>Books kept (active checkouts): <b>{summary.booksKeptDueToActiveCheckouts}</b></div>
      <div>Copies added: <b>{summary.copiesAdded}</b></div>
      <div>Copies removed: <b>{summary.copiesRemoved}</b></div>
    </div>
    <p class="mt-3 text-sm"><a href="/admin/catalog" class="underline">Upload another file</a></p>
  </div>
{/if}

{#if !plan && !summary}
  <div class="card max-w-2xl">
    <p class="text-slate-700 text-sm">
      Upload a LibraryThing JSON export to preview a dry-run diff. Nothing changes until you click <b>Apply</b>.
    </p>
    <form method="POST" action="?/preview" enctype="multipart/form-data" use:enhance class="mt-4 space-y-3">
      <input type="file" name="file" accept="application/json,.json" required class="block w-full text-sm" />
      {#if form?.error}<div class="text-rose-700 text-sm">{form.error}</div>{/if}
      <button class="btn-primary">Preview changes</button>
    </form>
  </div>
{/if}

{#if plan && !summary}
  <div class="card mb-4">
    <h2 class="text-lg font-medium">Dry-run summary{form.fileName ? ` · ${form.fileName}` : ''}</h2>
    <div class="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
      <div class="rounded-lg bg-emerald-50 px-3 py-2"><div class="text-xs text-emerald-700 uppercase">Add</div><div class="text-2xl font-bold">{plan.totals.booksAdded}</div></div>
      <div class="rounded-lg bg-amber-50 px-3 py-2"><div class="text-xs text-amber-700 uppercase">Update</div><div class="text-2xl font-bold">{plan.totals.booksUpdated}</div></div>
      <div class="rounded-lg bg-rose-50 px-3 py-2"><div class="text-xs text-rose-700 uppercase">Delete</div><div class="text-2xl font-bold">{plan.totals.booksRemoved}</div></div>
      <div class="rounded-lg bg-slate-100 px-3 py-2"><div class="text-xs text-slate-600 uppercase">Net copies</div><div class="text-2xl font-bold">{plan.totals.copiesAdded - plan.totals.copiesRemoved >= 0 ? '+' : ''}{plan.totals.copiesAdded - plan.totals.copiesRemoved}</div></div>
    </div>

    {#if needsConfirm}
      <div class="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 px-4 py-3 ring-1 ring-amber-200">
        <span class="text-amber-600 text-xl leading-none" aria-hidden="true">⚠️</span>
        <div class="text-sm text-amber-900">
          <b>{plan.totals.copiesRemovedWithActive}</b>
          {plan.totals.copiesRemovedWithActive === 1 ? 'copy is' : 'copies are'}
          currently checked out to patrons but would be removed by this import. Those copies will be <b>kept</b>
          until the patron returns them — you'll be asked to confirm before applying.
        </div>
      </div>
    {/if}
  </div>

  <div class="space-y-3">
    <!-- ADD -->
    <details class="card p-0" open={plan.add.length > 0}>
      <summary class="cursor-pointer px-5 py-3 flex items-center justify-between hover:bg-slate-50 rounded-2xl">
        <span class="font-medium"><span class="text-emerald-700">＋</span> Add ({plan.add.length})</span>
        <span class="text-xs text-slate-500">{plan.add.reduce((s, b) => s + b.copies, 0)} new copies</span>
      </summary>
      {#if plan.add.length === 0}
        <div class="px-5 py-3 text-sm text-slate-500">No new books.</div>
      {:else}
        <ul class="divide-y divide-slate-200">
          {#each plan.add as b}
            <li class="px-5 py-2 text-sm flex items-center justify-between">
              <div>
                <div class="font-medium">{b.title}</div>
                {#if b.primary_author}<div class="text-xs text-slate-500">{b.primary_author}</div>{/if}
              </div>
              <div class="text-xs text-slate-600 text-right">
                {b.copies} {b.copies === 1 ? 'copy' : 'copies'}
                · explicit {b.bySource.explicit} / isbn {b.bySource.isbn} / none {b.bySource.none}
              </div>
            </li>
          {/each}
        </ul>
      {/if}
    </details>

    <!-- UPDATE -->
    <details class="card p-0">
      <summary class="cursor-pointer px-5 py-3 flex items-center justify-between hover:bg-slate-50 rounded-2xl">
        <span class="font-medium"><span class="text-amber-700">✎</span> Update ({plan.update.length})</span>
        <span class="text-xs text-slate-500">+{plan.totals.copiesAdded - plan.add.reduce((s, b) => s + b.copies, 0)} / −{plan.totals.copiesRemoved} copies</span>
      </summary>
      {#if plan.update.length === 0}
        <div class="px-5 py-3 text-sm text-slate-500">No updates.</div>
      {:else}
        <ul class="divide-y divide-slate-200">
          {#each plan.update as b}
            {@const hasActiveRemoval = b.copiesToRemove.some((c) => c.hasActiveCheckout)}
            <li class="px-5 py-2 text-sm">
              <div class="flex items-center justify-between">
                <div>
                  <div class="font-medium flex items-center gap-2">
                    {#if hasActiveRemoval}<span class="text-amber-600" title="A copy being removed is currently checked out" aria-label="warning">⚠️</span>{/if}
                    {b.title}
                  </div>
                  {#if b.primary_author}<div class="text-xs text-slate-500">{b.primary_author}</div>{/if}
                </div>
                <div class="text-xs text-slate-600 text-right">
                  {#if b.fieldsChanged.length}<div>fields: {b.fieldsChanged.join(', ')}</div>{/if}
                  {#if b.copiesToAdd.length}<div class="text-emerald-700">+{b.copiesToAdd.length} {b.copiesToAdd.length === 1 ? 'copy' : 'copies'}</div>{/if}
                  {#if b.copiesToRemove.length}<div class="text-rose-700">−{b.copiesToRemove.length} {b.copiesToRemove.length === 1 ? 'copy' : 'copies'}</div>{/if}
                </div>
              </div>
              {#if b.copiesToAdd.length || b.copiesToRemove.length}
                <div class="mt-1 ml-1 grid grid-cols-1 md:grid-cols-2 gap-1 text-xs font-mono text-slate-600">
                  {#each b.copiesToAdd as c}
                    <div class="text-emerald-700">+ {formatBarcode(c.barcode)}</div>
                  {/each}
                  {#each b.copiesToRemove as c}
                    <div class="text-rose-700">
                      − {formatBarcode(c.barcode)}
                      {#if c.hasActiveCheckout}<span class="ml-1 text-amber-600" title="Currently checked out" aria-label="warning">⚠️</span>{/if}
                    </div>
                  {/each}
                </div>
              {/if}
            </li>
          {/each}
        </ul>
      {/if}
    </details>

    <!-- DELETE -->
    <details class="card p-0" open={plan.delete.some((b) => b.activeCheckouts > 0)}>
      <summary class="cursor-pointer px-5 py-3 flex items-center justify-between hover:bg-slate-50 rounded-2xl">
        <span class="font-medium">
          <span class="text-rose-700">−</span> Delete ({plan.delete.length})
          {#if plan.totals.booksWithActiveBlockingDelete > 0}
            <span class="ml-2 text-amber-600" title="Some books being deleted have active checkouts" aria-label="warning">⚠️</span>
          {/if}
        </span>
        <span class="text-xs text-slate-500">
          {plan.delete.reduce((s, b) => s + b.copies, 0)} copies
          {#if plan.totals.booksWithActiveBlockingDelete > 0}
            · <span class="text-amber-700">{plan.totals.booksWithActiveBlockingDelete} with active checkouts</span>
          {/if}
        </span>
      </summary>
      {#if plan.delete.length === 0}
        <div class="px-5 py-3 text-sm text-slate-500">Nothing to delete.</div>
      {:else}
        <ul class="divide-y divide-slate-200">
          {#each plan.delete as b}
            <li class="px-5 py-2 text-sm flex items-center justify-between {b.activeCheckouts > 0 ? 'bg-amber-50/50' : ''}">
              <div>
                <div class="font-medium flex items-center gap-2">
                  {#if b.activeCheckouts > 0}<span class="text-amber-600" title="Currently checked out" aria-label="warning">⚠️</span>{/if}
                  {b.title}
                </div>
                {#if b.primary_author}<div class="text-xs text-slate-500">{b.primary_author}</div>{/if}
              </div>
              <div class="text-xs text-right">
                <div class="text-slate-600">{b.copies} {b.copies === 1 ? 'copy' : 'copies'}</div>
                {#if b.activeCheckouts > 0}
                  <div class="text-amber-700 font-medium">{b.activeCheckouts} checked out — will be kept</div>
                {/if}
              </div>
            </li>
          {/each}
        </ul>
      {/if}
    </details>
  </div>

  <!-- Actions -->
  <div class="mt-6 flex gap-3 items-center">
    <form bind:this={applyFormEl} method="POST" action="?/apply" use:enhance>
      <input type="hidden" name="token" value={form.token} />
      <button type="submit" class="btn-primary" onclick={onApplyClick}>Apply changes</button>
    </form>
    <form method="POST" action="?/cancel" use:enhance>
      <input type="hidden" name="token" value={form.token} />
      <button class="btn-secondary">Cancel</button>
    </form>
    {#if needsConfirm}
      <span class="text-sm text-amber-700 flex items-center gap-1">
        <span aria-hidden="true">⚠️</span> Will ask to confirm
      </span>
    {/if}
  </div>
{/if}

<!-- Confirmation modal -->
{#if showConfirm && plan}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
    <div class="card max-w-md w-full">
      <div class="flex items-start gap-3">
        <span class="text-amber-500 text-2xl leading-none" aria-hidden="true">⚠️</span>
        <div>
          <h3 class="text-lg font-semibold">Confirm catalog replacement</h3>
          <p class="mt-2 text-sm text-slate-700">
            Some items being removed by this import are <b>currently checked out to patrons</b>:
          </p>
          <ul class="mt-2 text-sm text-slate-700 list-disc pl-5 space-y-1">
            {#if plan.totals.booksWithActiveBlockingDelete > 0}
              <li>
                <b>{plan.totals.booksWithActiveBlockingDelete}</b>
                {plan.totals.booksWithActiveBlockingDelete === 1 ? 'book' : 'books'} would be deleted entirely.
              </li>
            {/if}
            {#if plan.totals.copiesRemovedWithActive > 0}
              <li>
                <b>{plan.totals.copiesRemovedWithActive}</b>
                physical {plan.totals.copiesRemovedWithActive === 1 ? 'copy' : 'copies'} (specific barcodes) would be removed.
              </li>
            {/if}
          </ul>
          <p class="mt-3 text-sm text-slate-700">
            To avoid losing track of patrons' loans, these items will be <b>kept in the system</b> and removed
            automatically once they're checked back in.
          </p>
          <p class="mt-3 text-sm text-slate-700">Continue with the import?</p>
        </div>
      </div>
      <div class="mt-5 flex justify-end gap-2">
        <button class="btn-secondary" onclick={() => (showConfirm = false)}>Back</button>
        <button class="btn-danger" onclick={confirmAndSubmit}>Yes, apply</button>
      </div>
    </div>
  </div>
{/if}
