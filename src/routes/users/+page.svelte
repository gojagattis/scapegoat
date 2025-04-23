<script>
    import { onMount, tick } from 'svelte';
    import { query, capitalize, singularize, limit, mutate } from '$lib/common';
    import dayjs from "dayjs";
    import { page } from '$app/state';
    import {browser} from "$app/environment";

    const resource = page.url.pathname
    const gridHide = $state(['password', 'creator'])
    const formHide = $state(['id', 'creator', 'created', 'updated'])
    let models = $state([])
    let model = $state({})
    let schema = $state([])
    let grid = $state(true)
    let err = $state('')

    $effect(() => {
        if (grid || !grid) {
            err = ''
            model = {}
        }
    })

    //pagination
    let skip = 0
    let take = limit

    //sort
    let order = ''
    let sort = ''

    function refresh(data) {
        models = data
        models.forEach(model => {
            const roles = []
            model.roles.forEach(role => roles.push(role.name))
            model.roles = roles
        })
    }

    onMount(async () => {
        const response = (await query(`${resource}?schema=include&include=roles@name`)).json
        refresh(response.data)
        schema = response.schema
    })

    async function add() {
        err = ''
        Object.keys(model).forEach(k => {
            const meta = schema.find(s => s.name === k)
            if (meta.type === 'DateTime') {
                model[k] = new Date(model[k])
            }
        })
        let response = await mutate(resource, model)
        if (response.ok) {
            refresh((await query(`${resource}?include=roles@name`)).json)
            grid = true
        } else {
            err = response.json.message
            document.forms[0].elements[0].focus()
        }
    }

    function orderBy(col) {

    }

</script>

<svelte:window on:keyup={e => {
    if (e.key === 'Escape') {
        grid = true
    }
}} on:keydown={e => {
    if (e.ctrlKey && e.key === '`') {
        grid = false
        tick().then(() => {
            document.forms[0].elements[0].focus()
        })
    }
}}></svelte:window>

{#if grid}
    <h3>{capitalize(resource)}</h3><button onclick={() => grid = false}>Add</button>
    <table>
        <thead>
        <tr>
            {#each schema as col}
                {#if !gridHide.includes(col.name)}
                    <th><span onclick={async () => await orderBy(col.name)}>{capitalize(col.name)}</span></th>
                {/if}
            {/each}
        </tr>
        </thead>
        <tbody>
        {#each models as item}
            <tr>
                {#each schema as col}
                    {#if !gridHide.includes(col.name)}
                        {#if col.type === 'DateTime'}
                            <td>{item[col.name] ? dayjs(item[col.name]).format('YYYY-MM-DD HH:mm') : ''}</td>
                        {:else if col.type === 'Boolean'}
                            <td><input type="checkbox" onclick={e => e.preventDefault()} bind:checked={item[col.name]}></td>
                        {:else }
                            <td>{item[col.name]}</td>
                        {/if}
                    {/if}
                {/each}
            </tr>
        {/each}
        </tbody>
    </table>
{:else}
    <h3>Add {singularize(resource)}</h3>
    (* indicates required field)
    <br><span style="color: red;">{err}</span>
    <form>
        {#each schema as col}
            {#if !formHide.includes(col.name)}
                <label>{capitalize(col.name)}{col.isRequired && col.type !== 'Boolean' ? '*' : ''} :
                    {#if col.type === 'Boolean'}
                        <input type="checkbox" bind:checked={model[col.name]}><p></p>
                    {:else if col.type === 'String'}
                        {#if col.name === 'password'}
                            <input type="password" bind:value={model[col.name]}>
                        {:else}
                            <input type="text" bind:value={model[col.name]}>
                        {/if}
                    {:else if col.type === 'Int'}
                        <input type="number" bind:value={model[col.name]}>
                    {:else if col.type === 'Float'}
                        <input type="number" bind:value={model[col.name]}>
                    {:else if col.type === 'DateTime'}
                        <input type="datetime-local" bind:value={model[col.name]}>
                    {/if}
                </label>
            {/if}
        {/each}
        <button onclick={add}>Add</button>
        <button onclick={() => grid = true}>Cancel</button>
    </form>
{/if}

<style>
    h3 {
        display: inline;
    }
</style>
