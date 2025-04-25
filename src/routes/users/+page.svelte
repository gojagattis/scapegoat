<script>
    import { onMount, tick } from 'svelte';
    import { query, capitalize, singularize, limit, mutate } from '$lib/common';
    import dayjs from "dayjs";
    import { page } from '$app/state';
    import {browser} from "$app/environment";

    const resource = page.url.pathname
    let gridHide = $state(browser && localStorage.getItem(resource) ? JSON.parse(localStorage.getItem(resource)) : ['id', 'password', 'creator', 'created'])
    const formHide = $state(['id', 'creator', 'created', 'updated'])
    let models = $state([])
    let model = $state({})
    let columns = $state({})
    let schema = $state([])
    let grid = $state(true)
    let err = $state('')
    let skip = 0
    let take = limit
    let order, sort

    $effect(() => {
        if (grid) {
            err = ''
            model = {}
        }
        if (!grid) {
            err = ''
        }
    })

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
        schema.forEach(s => columns[s.name] = true)
        gridHide.forEach(col => columns[col] = false)
    })

    async function add() {
        Object.keys(model).forEach(k => {
            const meta = schema.find(s => s.name === k)
            if (meta.type === 'DateTime') {
                model[k] = model[k] ? new Date(model[k]) : null
            }
        })
        const response = await mutate(`${resource}${model.id ? `/${model.id}` : ``}`, model, model.id ? 'PUT' : 'POST')
        if (response.ok) {
            err = ''
            model = {}
            refresh((await query(`${resource}?include=roles@name`)).json)
            grid = true
        } else {
            err = response.json.message
            document.forms[0].elements[0].focus()
        }
    }

    function edit(item) {
        err = ''
        model = {...item}
        grid = false
        Object.keys(model).forEach(k => {
            const meta = schema.find(s => s.name === k)
            if (meta.type === 'DateTime' && model[k]) {
                model[k] = model[k].slice(0, -14) // format for display in datepicker
            }
        })
    }

    async function remove(id) {
        const response = await query(`${resource}/${id}`, 'DELETE')
        if (response.ok) {
            err = ''
            models = models.toSpliced(models.findIndex(m => m.id === id), 1)
        } else {
            err = response.json.message
        }
    }

    function show(field) {
        gridHide = gridHide.includes(field) ? gridHide.filter(i => i !== field) : [...gridHide, field]
        localStorage.setItem(resource, JSON.stringify(gridHide))
    }

    async function orderBy(col) {
        order = col
        sort = sort === undefined || sort === 'asc' ? 'desc' : 'asc'
        refresh((await query(`${resource}?include=roles@name&order=${order}&sort=${sort}`)).json)
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
    <nav>
        <ul>
            <li><h3>{capitalize(resource)}</h3><button onclick={() => grid = false}>Add</button></li>
            <li><a href="#/">Columns ▾</a>
                <ul>
                    {#each schema as col}
                        <li><label><input type="checkbox" onclick={() => show(col.name)} bind:checked={columns[col.name]}> {col.name}</label></li>
                    {/each}
                </ul>
            </li>
        </ul>
    </nav>
    <span style="color: red;">{err}</span>
    <table>
        <thead>
        <tr>
            {#each schema as col}
                {#if !gridHide.includes(col.name)}
                    <th>
                        {#if col.kind === 'scalar'}
                            <a href="#/" onclick={async () => await orderBy(col.name)}>{capitalize(col.name)}</a>
                        {:else}
                            {capitalize(col.name)}
                        {/if}
                    </th>
                {/if}
            {/each}
            <th></th>
            <th></th>
        </tr>
        </thead>
        <tbody>
        {#each models as item}
            <tr>
                {#each schema as col}
                    {#if !gridHide.includes(col.name)}
                        {#if col.type === 'DateTime'}
                            <td>{item[col.name] ? item[col.name].endsWith('T00:00:00.000Z') ? dayjs(item[col.name]).format('YYYY-MM-DD') : dayjs(item[col.name]).format('YYYY-MM-DD HH:mm') : ''}</td>
                        {:else if col.type === 'Boolean'}
                            {#if item[col.name]}
                                <td><i class="si-check"></i></td>
                            {:else}
                                <td><i class="si-x"></i></td>
                            {/if}
<!--                            <td><input type="checkbox" onclick={e => e.preventDefault()} bind:checked={item[col.name]}></td>-->
                        {:else }
                            <td>{item[col.name]}</td>
                        {/if}
                    {/if}
                {/each}
                <td><a href="#/" onclick={() => edit(item)}><i class="si-edit"></i></a></td>
                <td><a href="#/" onclick={() => remove(item.id)}><i class="si-trash"></i></a></td>
            </tr>
        {/each}
        </tbody>
    </table>
{:else}
    <h3>{model.id ? 'Edit' : 'Add'} {singularize(resource)}</h3>
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
                        <input type="date" bind:value={model[col.name]}>
                    {/if}
                </label>
            {/if}
        {/each}
        <button onclick={add}>{model.id ? 'Edit' : 'Add'}</button>
        <button onclick={() => grid = true}>Cancel</button>
    </form>
{/if}

<style>
    h3, nav {
        display: inline;
    }
</style>
