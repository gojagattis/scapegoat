<script>
    import {onMount} from "svelte";
    import {bearer, query, capitalize, singularize, take} from "$lib/common";
    import dayjs from "dayjs";
    import { page } from '$app/state';
    import {browser} from "$app/environment";

    const entity = 'users'
    const hidden = $state([])
    let models = $state([])
    let schema = $state([])

    //pagination
    let skip = 0
    let limit = take

    //sort
    let order = ''
    let sort = ''

    onMount(async () => {
        const response = await query(`/${entity}?schema=include`)
        models = response.data
        schema = response.schema
    })

    function orderBy(col) {

    }

</script>

<svelte:window on:keyup={e => {
    if (e.key === 'Escape') {
        // hide()
    }
}} on:keydown={e => {
    if (e.ctrlKey && e.key === '`') {
        // add()
    }
}}></svelte:window>


<table>
    <thead>
    <tr>
        {#each schema as col}
            <!--{#if !hidden.includes(col.name)}-->
                <th><span on:click={async () => await orderBy(col.name)}>{capitalize(col.name)}</span></th>
            <!--{/if}-->
        {/each}
    </tr>
    </thead>
    <tbody>
    {#each models as item}
        <tr>
            {#each schema as col}
                {#if !hidden.includes(col.name)}
                    {#if col.type === 'DateTime'}
                        <td>{item[col.name] ? dayjs(item[col.name]).format('YYYY-MM-DD HH:mm') : ''}</td>
                    {:else }
                        <td>{item[col.name]}</td>
                    {/if}
                {/if}
            {/each}
        </tr>
    {/each}
    </tbody>
</table>
