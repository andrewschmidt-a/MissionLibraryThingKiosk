<script lang="ts">
  let { data, form } = $props();
</script>

<svelte:head><title>Admin Login</title></svelte:head>

<div class="mx-auto max-w-md">
  {#if !data.configured}
    <div class="card">
      <h1 class="text-2xl font-semibold">Set Admin Password</h1>
      <p class="mt-1 text-sm text-slate-600">First-time setup. Choose a password to protect the admin area.</p>
      <form method="POST" action="?/setup" class="mt-4 space-y-3">
        <label class="block">
          <span class="text-sm text-slate-700">Password</span>
          <input class="input mt-1" type="password" name="password" required autofocus />
        </label>
        <label class="block">
          <span class="text-sm text-slate-700">Confirm password</span>
          <input class="input mt-1" type="password" name="confirm" required />
        </label>
        {#if form?.error}<div class="text-rose-700 text-sm">{form.error}</div>{/if}
        <button class="btn-primary w-full">Save & Sign In</button>
      </form>
    </div>
  {:else}
    <div class="card">
      <h1 class="text-2xl font-semibold">Admin Sign In</h1>
      <form method="POST" action="?/login" class="mt-4 space-y-3">
        <label class="block">
          <span class="text-sm text-slate-700">Password</span>
          <input class="input mt-1" type="password" name="password" required autofocus />
        </label>
        {#if form?.error}<div class="text-rose-700 text-sm">{form.error}</div>{/if}
        <button class="btn-primary w-full">Sign In</button>
      </form>
    </div>
  {/if}
</div>
