<script>
    import {getContext, onMount} from "svelte";

    const authenticated = getContext('authenticated')

    onMount(async () => {
    })
</script>

{#if $authenticated}
    <h1>Superpowers (battries included)</h1>
    <ul>
        <li>...</li>
        <li>(Long list)</li>
    </ul>
{/if}

