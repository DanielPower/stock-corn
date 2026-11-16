<script lang="ts">
    import "../app.css";
    import corn from "$lib/assets/corn.png";

    let { children } = $props();
    let mobileMenuOpen = $state(false);

    const navItems = [
        { href: "/", label: "Dashboard" },
        { href: "/leaderboard", label: "Leaderboard" },
        { href: "/market", label: "Market" },
        { href: "/ledger", label: "Ledger" },
        { href: "/trades", label: "Trades" },
    ];

    function toggleMobileMenu() {
        mobileMenuOpen = !mobileMenuOpen;
    }
</script>

<svelte:head>
    <link rel="icon" href={corn} />
</svelte:head>

<div class="min-h-screen bg-stone-900 text-stone-50">
    <!-- Header -->
    <header class="bg-stone-800 border-b border-stone-700 sticky top-0 z-50">
        <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex justify-between items-center h-16">
                <!-- Logo -->
                <div class="flex items-center space-x-3">
                    <img src={corn} alt="Logo" class="h-12 w-12 rounded-lg" />
                    <h1 class="text-xl font-bold text-stone-50">StockCorn</h1>
                </div>

                <!-- Navigation -->
                <nav class="hidden md:flex space-x-8">
                    {#each navItems as item}
                        <a
                            href={item.href}
                            class="text-stone-300 hover:text-stone-50 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                        >
                            {item.label}
                        </a>
                    {/each}
                </nav>

                <!-- Mobile menu button -->
                <div class="md:hidden">
                    <button
                        type="button"
                        onclick={toggleMobileMenu}
                        class="text-stone-300 hover:text-stone-50 focus:outline-none focus:text-stone-50"
                    >
                        {#if mobileMenuOpen}
                            <svg
                                class="h-6 w-6"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M6 18L18 6M6 6l12 12"
                                />
                            </svg>
                        {:else}
                            <svg
                                class="h-6 w-6"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M4 6h16M4 12h16M4 18h16"
                                />
                            </svg>
                        {/if}
                    </button>
                </div>
            </div>

            <!-- Mobile Navigation Menu -->
            {#if mobileMenuOpen}
                <div class="md:hidden bg-stone-800 border-t border-stone-700">
                    <div class="px-2 pt-2 pb-3 space-y-1">
                        {#each navItems as item}
                            <a
                                href={item.href}
                                onclick={toggleMobileMenu}
                                class="text-stone-300 hover:text-stone-50 hover:bg-stone-700 block px-3 py-2 rounded-md text-base font-medium transition-colors"
                            >
                                {item.label}
                            </a>
                        {/each}
                    </div>
                </div>
            {/if}
        </div>
    </header>

    <!-- Main Content -->
    <main class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {@render children?.()}
    </main>

    <!-- Footer -->
    <footer class="bg-stone-800 border-t border-stone-700 mt-auto">
        <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div class="text-center text-stone-400 text-sm">
                <p>&copy; 2024 StockCorn. All rights reserved.</p>
            </div>
        </div>
    </footer>
</div>
