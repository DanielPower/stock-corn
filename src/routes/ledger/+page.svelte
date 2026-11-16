<script lang="ts">
    import { goto } from "$app/navigation";
    import { page } from "$app/stores";
    import corn from "$lib/assets/corn.png";
    import { Commodities, getCommodityName } from "$lib/commodities";
    import { format } from "date-fns";
    import type { PageServerData } from "./$types";

    let { data }: { data: PageServerData } = $props();

    function getDisplayName(username: string | null, farmerId: string): string {
        if (farmerId === "BANK") return "🏦 BANK";
        if (farmerId === "JAIL") return "🔒 JAIL";
        return username || "Unknown User";
    }

    function getAvatarUrl(avatarUrl: string | null, farmerId: string): string {
        if (farmerId === "BANK" || farmerId === "JAIL") return corn;
        return avatarUrl || corn;
    }

    function getCommodityEmoji(commodity: number): string {
        switch (commodity) {
            case Commodities.Corn:
                return "🌽";
            case Commodities.CropCoins:
                return "🪙";
            case Commodities.Tnt:
                return "🧨";
            case Commodities.Maria:
                return "👑";
            case Commodities.Chips:
                return "🎰";
            default:
                return "❓";
        }
    }

    function formatDate(dateString: string): string {
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) {
                return "Invalid Date";
            }
            return format(date, "MMM dd, yyyy HH:mm:ss");
        } catch {
            return "Invalid Date";
        }
    }

    function buildPageUrl(pageNum: number): string {
        const url = new URL($page.url);
        url.searchParams.set("page", pageNum.toString());
        return url.pathname + url.search;
    }

    function changePageSize(newPageSize: string) {
        const url = new URL($page.url);
        url.searchParams.set("pageSize", newPageSize);
        url.searchParams.set("page", "1");
        goto(url.toString());
    }
</script>

<svelte:head>
    <title>Ledger - StockCorn</title>
</svelte:head>

<div class="space-y-6">
    <div class="text-center">
        <h1 class="text-3xl font-bold text-stone-50 mb-2">📊 Trade Ledger</h1>
        <p class="text-stone-300">All trading activity across the farm</p>
    </div>

    <div class="flex justify-between items-center">
        <div class="text-stone-400 text-sm">
            Total trades: {data.pagination.total.toLocaleString()}
        </div>

        <div class="flex items-center space-x-4">
            <label class="text-stone-300 text-sm">
                Trades per page:
                <select
                    class="ml-2 bg-stone-700 border border-stone-600 rounded px-2 py-1 text-stone-50"
                    onchange={(e) => changePageSize(e.currentTarget.value)}
                >
                    <option
                        value="10"
                        selected={data.pagination.pageSize === 10}>10</option
                    >
                    <option
                        value="20"
                        selected={data.pagination.pageSize === 20}>20</option
                    >
                    <option
                        value="50"
                        selected={data.pagination.pageSize === 50}>50</option
                    >
                    <option
                        value="100"
                        selected={data.pagination.pageSize === 100}>100</option
                    >
                </select>
            </label>
        </div>
    </div>

    <div
        class="bg-stone-800 rounded-lg border border-stone-700 overflow-hidden"
    >
        <div class="overflow-x-auto">
            <table class="w-full">
                <thead class="bg-stone-700">
                    <tr>
                        <th
                            class="px-6 py-4 text-left text-xs font-medium text-stone-300 uppercase tracking-wider"
                        >
                            Source
                        </th>
                        <th
                            class="px-6 py-4 text-left text-xs font-medium text-stone-300 uppercase tracking-wider"
                        >
                            Destination
                        </th>
                        <th
                            class="px-6 py-4 text-center text-xs font-medium text-stone-300 uppercase tracking-wider"
                        >
                            Trade
                        </th>
                        <th
                            class="px-6 py-4 text-right text-xs font-medium text-stone-300 uppercase tracking-wider"
                        >
                            Date
                        </th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-stone-700">
                    {#each data.trades as trade}
                        <tr class="hover:bg-stone-750 transition-colors">
                            <!-- Source -->
                            <td class="px-6 py-4 whitespace-nowrap">
                                <div class="flex items-center space-x-3">
                                    <img
                                        src={getAvatarUrl(
                                            trade.source_avatar_url,
                                            trade.source_farmer,
                                        )}
                                        alt="{getDisplayName(
                                            trade.source_username,
                                            trade.source_farmer,
                                        )}'s avatar"
                                        class="h-8 w-8 rounded-full border border-stone-600"
                                        loading="lazy"
                                        onerror={(e) =>
                                            ((
                                                e.currentTarget as HTMLImageElement
                                            ).src = corn)}
                                    />
                                    <div>
                                        <div
                                            class="text-sm font-medium text-stone-50"
                                        >
                                            {getDisplayName(
                                                trade.source_username,
                                                trade.source_farmer,
                                            )}
                                        </div>
                                        <div class="text-xs text-stone-400">
                                            {trade.source_farmer}
                                        </div>
                                    </div>
                                </div>
                            </td>

                            <!-- Trade -->
                            <td class="px-6 py-4 whitespace-nowrap">
                                <div class="text-center">
                                    <div
                                        class="items-center justify-center space-x-2 text-sm"
                                    >
                                        {#each trade.transfers as transfer}
                                            <div>
                                                {transfer.amount < 0
                                                    ? "⬅️"
                                                    : ""}
                                                {getCommodityEmoji(
                                                    transfer.commodity_id,
                                                )}
                                                {getCommodityName(
                                                    transfer.commodity_id,
                                                )}

                                                {Math.abs(transfer.amount)}
                                                {transfer.amount > 0
                                                    ? "➡️"
                                                    : ""}
                                            </div>
                                        {/each}
                                    </div>
                                </div>
                            </td>

                            <!-- Destination -->
                            <td class="px-6 py-4 whitespace-nowrap">
                                <div class="flex items-center space-x-3">
                                    <img
                                        src={getAvatarUrl(
                                            trade.destination_avatar_url,
                                            trade.destination_farmer,
                                        )}
                                        alt="{getDisplayName(
                                            trade.destination_username,
                                            trade.destination_farmer,
                                        )}'s avatar"
                                        class="h-8 w-8 rounded-full border border-stone-600"
                                        loading="lazy"
                                        onerror={(e) =>
                                            ((
                                                e.currentTarget as HTMLImageElement
                                            ).src = corn)}
                                    />
                                    <div>
                                        <div
                                            class="text-sm font-medium text-stone-50"
                                        >
                                            {getDisplayName(
                                                trade.destination_username,
                                                trade.destination_farmer,
                                            )}
                                        </div>
                                        <div class="text-xs text-stone-400">
                                            {trade.destination_farmer}
                                        </div>
                                    </div>
                                </div>
                            </td>

                            <!-- Date -->
                            <td class="px-6 py-4 whitespace-nowrap text-right">
                                <div class="text-sm text-stone-50">
                                    {formatDate(trade.date)}
                                </div>
                            </td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        </div>

        <!-- Pagination -->
        {#if data.pagination.totalPages > 1}
            <div
                class="bg-stone-700 px-6 py-4 flex items-center justify-between border-t border-stone-600"
            >
                <div class="flex items-center space-x-2">
                    <span class="text-sm text-stone-300">
                        Showing {(data.pagination.page - 1) *
                            data.pagination.pageSize +
                            1} to {Math.min(
                            data.pagination.page * data.pagination.pageSize,
                            data.pagination.total,
                        )} of {data.pagination.total} trades
                    </span>
                </div>

                <div class="flex items-center space-x-2">
                    <a
                        href={buildPageUrl(1)}
                        class="px-3 py-1 text-sm bg-stone-600 text-stone-300 rounded hover:bg-stone-500 {data
                            .pagination.page === 1
                            ? 'opacity-50 cursor-not-allowed'
                            : ''} transition-colors"
                        class:disabled={data.pagination.page === 1}
                    >
                        First
                    </a>

                    <a
                        href={buildPageUrl(data.pagination.page - 1)}
                        class="px-3 py-1 text-sm bg-stone-600 text-stone-300 rounded hover:bg-stone-500 {data
                            .pagination.page === 1
                            ? 'opacity-50 cursor-not-allowed'
                            : ''} transition-colors"
                        class:disabled={data.pagination.page === 1}
                    >
                        Previous
                    </a>

                    <span class="text-sm text-stone-300">
                        Page {data.pagination.page} of {data.pagination
                            .totalPages}
                    </span>

                    <a
                        href={buildPageUrl(data.pagination.page + 1)}
                        class="px-3 py-1 text-sm bg-stone-600 text-stone-300 rounded hover:bg-stone-500 {data
                            .pagination.page === data.pagination.totalPages
                            ? 'opacity-50 cursor-not-allowed'
                            : ''} transition-colors"
                        class:disabled={data.pagination.page ===
                            data.pagination.totalPages}
                    >
                        Next
                    </a>

                    <a
                        href={buildPageUrl(data.pagination.totalPages)}
                        class="px-3 py-1 text-sm bg-stone-600 text-stone-300 rounded hover:bg-stone-500 {data
                            .pagination.page === data.pagination.totalPages
                            ? 'opacity-50 cursor-not-allowed'
                            : ''} transition-colors"
                        class:disabled={data.pagination.page ===
                            data.pagination.totalPages}
                    >
                        Last
                    </a>
                </div>
            </div>
        {/if}
    </div>

    {#if data.trades.length === 0}
        <div class="text-center py-12">
            <div class="text-6xl mb-4">📊</div>
            <h2 class="text-xl font-semibold text-stone-300 mb-2">
                No trades found
            </h2>
            <p class="text-stone-400">No trading activity to display yet.</p>
        </div>
    {/if}
</div>

<style>
    .hover\:bg-stone-750:hover {
        background-color: #44403c;
    }

    .disabled {
        pointer-events: none;
    }
</style>
