<script lang="ts">
  import { enhance } from '$app/forms';
  import { tick } from 'svelte';

  let { form }: { form: any } = $props();

  let phone = $state('');
  let barcode = $state('');
  let barcodeInput: HTMLInputElement | null = $state(null);
  let phoneInput: HTMLInputElement | null = $state(null);

  // Reset success message after a short delay
  $effect(() => {
    if (form?.success) {
      const t = setTimeout(() => {
        phone = '';
        barcode = '';
        form = null;
        tick().then(() => phoneInput?.focus());
      }, 3500);
      return () => clearTimeout(t);
    }
  });

  function formatPhoneDisplay(d: string): string {
    const x = d.replace(/\D+/g, '').slice(0, 11);
    if (x.length <= 3) return x;
    if (x.length <= 6) return `(${x.slice(0, 3)}) ${x.slice(3)}`;
    if (x.length <= 10) return `(${x.slice(0, 3)}) ${x.slice(3, 6)}-${x.slice(6)}`;
    return `+${x.slice(0, 1)} (${x.slice(1, 4)}) ${x.slice(4, 7)}-${x.slice(7)}`;
  }
</script>

<svelte:head>
  <title>Library Checkout</title>
</svelte:head>

<main class="min-h-screen flex items-center justify-center p-6">
  <div class="w-full max-w-2xl space-y-6">
    <header class="text-center">
      <h1 class="text-4xl font-bold tracking-tight text-slate-900">Library Checkout</h1>
      <p class="mt-2 text-slate-600">Enter your phone number, then scan or type a barcode.</p>
    </header>

    {#if form?.success}
      <div class="card border-2 border-emerald-400 bg-emerald-50 text-center">
        <div class="text-2xl font-semibold text-emerald-800">Checked out!</div>
        <div class="mt-3 text-3xl font-bold">{form.title}</div>
        {#if form.author}<div class="mt-1 text-lg text-slate-700">by {form.author}</div>{/if}
        <div class="mt-4 text-slate-700">To: <span class="font-medium">{form.patronName}</span></div>
      </div>
    {:else if form?.needsPatron}
      <form method="POST" action="?/registerAndCheckout" use:enhance class="card space-y-4">
        <div class="text-center">
          <div class="text-sm uppercase tracking-wide text-slate-500">Checking out</div>
          <div class="mt-1 text-2xl font-semibold">{form.title}</div>
          {#if form.author}<div class="text-slate-600">by {form.author}</div>{/if}
        </div>
        <p class="text-center text-slate-700">We don't have you yet — please enter your name:</p>
        <input type="hidden" name="phone" value={form.phone} />
        <input type="hidden" name="copy_id" value={form.copyId} />
        <input type="hidden" name="title" value={form.title} />
        <input type="hidden" name="author" value={form.author ?? ''} />
        <div class="grid grid-cols-2 gap-3">
          <label class="block">
            <span class="text-sm text-slate-700">First name</span>
            <input class="input mt-1 text-lg" name="first_name" required autofocus value={form.first_name ?? ''} />
          </label>
          <label class="block">
            <span class="text-sm text-slate-700">Last name</span>
            <input class="input mt-1 text-lg" name="last_name" required value={form.last_name ?? ''} />
          </label>
        </div>
        {#if form.error}<div class="text-rose-700 text-sm">{form.error}</div>{/if}
        <button type="submit" class="btn-primary w-full text-lg py-3">Save & Check Out</button>
      </form>
    {:else}
      <form
        method="POST"
        action="?/lookup"
        use:enhance={() => {
          return async ({ update }) => {
            await update({ reset: false });
            // After result: focus phone again if success, else barcode
            tick().then(() => barcodeInput?.focus());
          };
        }}
        class="card space-y-5"
      >
        <label class="block">
          <span class="text-base font-medium text-slate-800">Phone number</span>
          <input
            bind:this={phoneInput}
            class="input mt-2 text-2xl tracking-wider"
            name="phone"
            inputmode="numeric"
            autocomplete="off"
            placeholder="(555) 123-4567"
            value={formatPhoneDisplay(phone)}
            oninput={(e) => (phone = (e.currentTarget as HTMLInputElement).value)}
            onfocus={(e) => (e.currentTarget as HTMLInputElement).select()}
            autofocus
            required
          />
        </label>

        <label class="block">
          <span class="text-base font-medium text-slate-800">Barcode</span>
          <input
            bind:this={barcodeInput}
            class="input mt-2 text-2xl tracking-wider"
            name="barcode"
            autocomplete="off"
            placeholder="Scan or type"
            bind:value={barcode}
            required
          />
        </label>

        {#if form?.error}
          <div class="rounded-lg bg-rose-50 px-4 py-3 text-rose-800 ring-1 ring-rose-200">
            {form.error}
          </div>
        {/if}

        <button type="submit" class="btn-primary w-full text-xl py-4">Enter</button>
      </form>
    {/if}

    <footer class="text-center text-xs text-slate-400">
      <a href="/admin" class="hover:text-slate-600">Admin</a>
    </footer>
  </div>
</main>
