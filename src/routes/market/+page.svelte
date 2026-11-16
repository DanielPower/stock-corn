<script lang="ts">
    import { invalidateAll } from "$app/navigation";
    import { formatChange, formatPrice } from "$lib/market/price";
    import { onMount } from "svelte";

    type PricePoint = { price: number; date: string; event: string | null };
    type PageData = {
        market: { price: number; trend: number } | null;
        history: PricePoint[];
        events: { price: number; date: string; event: string }[];
    };

    let { data }: { data: PageData } = $props();

    onMount(() => {
        const id = setInterval(() => invalidateAll(), 60_000);
        return () => clearInterval(id);
    });

    const W = 800;
    const H = 260;
    const PAD = 8;

    let prices = $derived([
        ...data.history.map((h) => h.price),
        ...(data.market ? [data.market.price] : []),
    ]);
    let low = $derived(prices.length ? Math.min(...prices) : 0);
    let high = $derived(prices.length ? Math.max(...prices) : 0);
    let current = $derived(data.market?.price ?? 0);
    let dayAgo = $derived(prices[0] ?? current);
    let hourAgo = $derived(prices[Math.max(0, prices.length - 61)] ?? current);
    let up = $derived(current >= dayAgo);

    let points = $derived.by(() => {
        if (prices.length < 2) return "";
        const range = high - low || 1;
        return prices
            .map((p, i) => {
                const x = PAD + (i / (prices.length - 1)) * (W - 2 * PAD);
                const y = PAD + (1 - (p - low) / range) * (H - 2 * PAD);
                return `${x.toFixed(1)},${y.toFixed(1)}`;
            })
            .join(" ");
    });

    const when = (date: string) => new Date(date + "Z").toLocaleString();
</script>

<svelte:head>
    <title>Market - StockCorn</title>
</svelte:head>

<div class="space-y-6">
    <div class="text-center">
        <h1 class="text-3xl font-bold text-stone-50 mb-2">🌽 Corn Exchange</h1>
        <p class="text-stone-300">
            Buy and sell corn with <code>/market</code>. Prices update every
            minute.
        </p>
    </div>

    {#if data.market}
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div class="bg-stone-800 rounded-lg border border-stone-700 p-4">
                <div class="text-xs uppercase text-stone-400">Price</div>
                <div class="text-2xl font-bold text-yellow-400">
                    {formatPrice(current)}
                </div>
                <div class="text-xs text-stone-400">CropCoins per cob</div>
            </div>
            <div class="bg-stone-800 rounded-lg border border-stone-700 p-4">
                <div class="text-xs uppercase text-stone-400">1h</div>
                <div class="text-xl font-semibold">
                    {formatChange(hourAgo, current)}
                </div>
            </div>
            <div class="bg-stone-800 rounded-lg border border-stone-700 p-4">
                <div class="text-xs uppercase text-stone-400">24h</div>
                <div class="text-xl font-semibold">
                    {formatChange(dayAgo, current)}
                </div>
            </div>
            <div class="bg-stone-800 rounded-lg border border-stone-700 p-4">
                <div class="text-xs uppercase text-stone-400">24h range</div>
                <div class="text-xl font-semibold">
                    {formatPrice(low)} – {formatPrice(high)}
                </div>
            </div>
        </div>

        <div class="bg-stone-800 rounded-lg border border-stone-700 p-4">
            <svg
                viewBox="0 0 {W} {H}"
                class="w-full h-64"
                preserveAspectRatio="none"
                role="img"
                aria-label="Corn price over the last 24 hours"
            >
                <polyline
                    {points}
                    fill="none"
                    stroke={up ? "#22c55e" : "#ef4444"}
                    stroke-width="2"
                    vector-effect="non-scaling-stroke"
                />
            </svg>
            <div class="flex justify-between text-xs text-stone-400 mt-2">
                <span>24h ago</span>
                <span>now</span>
            </div>
        </div>

        {#if data.events.length}
            <div class="bg-stone-800 rounded-lg border border-stone-700 p-4">
                <h2 class="text-lg font-semibold mb-3">📰 Market news</h2>
                <ul class="space-y-2">
                    {#each data.events as e}
                        <li class="flex justify-between gap-4 text-sm">
                            <span>{e.event}</span>
                            <span class="text-stone-400 whitespace-nowrap">
                                {formatPrice(e.price)} · {when(e.date)}
                            </span>
                        </li>
                    {/each}
                </ul>
            </div>
        {/if}
    {:else}
        <p class="text-center text-stone-400">The corn market is closed.</p>
    {/if}
</div>
