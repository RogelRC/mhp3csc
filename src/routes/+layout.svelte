<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { inject } from '@vercel/analytics';
	import { onMount } from 'svelte';

	let { children } = $props();

	onMount(() => {
		inject();
	});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
{@render children()}
