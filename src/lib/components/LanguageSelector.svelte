<script lang="ts">
	import { getLocale, setLocale, type Locale } from '$lib/i18n/i18n.svelte';

	const uid = $props.id();
	const options: { value: Locale; label: string }[] = [
		{ value: 'en', label: 'EN' },
		{ value: 'es', label: 'ES' }
	];
</script>

<div
	class="flex overflow-hidden rounded border border-zinc-700"
	role="group"
	aria-label="Language / Idioma"
>
	{#each options as o (o.value)}
		<button
			type="button"
			onclick={() => setLocale(o.value)}
			aria-pressed={getLocale() === o.value}
			title={o.value === 'en' ? 'English' : 'Español'}
			class="flex items-center gap-1.5 px-2 py-1 text-xs font-semibold transition-colors
				{getLocale() === o.value
				? 'bg-amber-500/20 text-amber-300'
				: 'text-zinc-400 opacity-80 hover:bg-zinc-800 hover:opacity-100'}"
		>
			{#if o.value === 'en'}
				<!-- Union Jack -->
				<svg viewBox="0 0 60 30" class="h-3.5 w-6 rounded-[2px]" aria-hidden="true">
					<defs>
						<clipPath id="{uid}-flag-en-s"><path d="M0,0 v30 h60 v-30 z" /></clipPath>
						<clipPath id="{uid}-flag-en-t">
							<path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z" />
						</clipPath>
					</defs>
					<g clip-path="url(#{uid}-flag-en-s)">
						<path d="M0,0 v30 h60 v-30 z" fill="#012169" />
						<path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" stroke-width="6" />
						<path
							d="M0,0 L60,30 M60,0 L0,30"
							clip-path="url(#{uid}-flag-en-t)"
							stroke="#C8102E"
							stroke-width="4"
						/>
						<path d="M30,0 v30 M0,15 h60" stroke="#fff" stroke-width="10" />
						<path d="M30,0 v30 M0,15 h60" stroke="#C8102E" stroke-width="6" />
					</g>
				</svg>
			{:else}
				<!-- Spain -->
				<svg viewBox="0 0 60 30" class="h-3.5 w-6 rounded-[2px]" aria-hidden="true">
					<rect width="60" height="30" fill="#F1BF00" />
					<rect width="60" height="7.5" fill="#AA151B" />
					<rect y="22.5" width="60" height="7.5" fill="#AA151B" />
				</svg>
			{/if}
			{o.label}
		</button>
	{/each}
</div>
