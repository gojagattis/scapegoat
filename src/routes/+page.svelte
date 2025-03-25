<script>
    import {afterUpdate, getContext, onMount} from "svelte";

    const authenticated = getContext('authenticated')

    afterUpdate(() => {
        feather.replace();
    })

    onMount(async () => {
    })
</script>

{#if $authenticated}
    <h1>Superpowers (battries included)</h1>
    <ul>
        <li>Role-based access control</li>
        <li>Multi-tenant</li>
    </ul>
{/if}

