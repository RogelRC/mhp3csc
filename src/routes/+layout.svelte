<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
{@render children()}

<footer class="bg-zinc-950 pt-2 pb-6">
	<div class="mx-auto w-full max-w-4xl px-4">
		<p class="text-center text-xs text-zinc-500">
			<span class="mr-1">Found a bug?</span>
			<a
				href="https://discord.com/users/1136464673479340203"
				target="_blank"
				rel="noopener noreferrer"
				class="text-amber-400 hover:text-amber-300 hover:underline"
			>
				Report it on Discord
			</a>
		</p>
		<p class="mt-1 text-center text-xs text-zinc-500">
			<span class="mr-1">Enjoying the project?</span>
			<a
				href="https://github.com/RogelRC/mhp3csc"
				target="_blank"
				rel="noopener noreferrer"
				class="text-amber-400 hover:text-amber-300 hover:underline"
			>
				Star it on GitHub
			</a>
		</p>
	</div>
</footer>
