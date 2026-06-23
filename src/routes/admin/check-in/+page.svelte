<script lang="ts">
  import { enhance } from '$app/forms';
  import { tick } from 'svelte';
  let { form } = $props();
  let input: HTMLInputElement | null = $state(null);

  $effect(() => {
    if (form) tick().then(() => input?.focus());
  });
</script>

<svelte:head><title>Check In</title></svelte:head>

<h1 class="text-2xl font-semibold mb-4">Check In</h1>

<div class="card max-w-lg">
  <form
    method="POST"
    use:enhance={() => async ({ update }) => {
      await update({ reset: true });
      tick().then(() => input?.focus());
    }}
    class="space-y-3"
  >
    <label class="block">
      <span class="text-sm text-slate-700">Barcode (scan or type)</span>
      <input bind:this={input} class="input mt-1 text-xl" name="barcode" autofocus autocomplete="off" required />
    </label>
    <button class="btn-primary w-full">Check In</button>
  </form>

  {#if form}
    <div
      class="mt-4 rounded-lg p-3 text-sm {form.ok ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200' : 'bg-rose-50 text-rose-800 ring-1 ring-rose-200'}"
    >
      <div class="font-medium">{form.message}</div>
      {#if form.ok && form.book}
        <div class="mt-1">
          <span class="text-slate-700">From:</span>
          <b>{form.patronName ?? '—'}</b>
        </div>
      {/if}
    </div>
  {/if}
</div>
