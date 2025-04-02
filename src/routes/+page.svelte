<script>
    import {getContext} from "svelte";

    const authenticated = getContext('authenticated')
</script>

{#if $authenticated}
    <h1>Superpowers (battries included)</h1>
    <ul>
        <li>...</li>
        <li>(Long list)</li>
    </ul>
{/if}

