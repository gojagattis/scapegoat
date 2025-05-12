<script>
    import { onMount, tick } from 'svelte';
    import { query, capitalize, singularize, limit, mutate } from '$lib/common';
    import dayjs from "dayjs";
    import { page } from '$app/state';
    import {browser} from "$app/environment";

    const resource = page.url.pathname.slice(1)
    let gridHide = $state(browser && localStorage.getItem(resource) ? JSON.parse(localStorage.getItem(resource)) : ['id', 'creator', 'created'])
    const formHide = $state(['id', 'creator', 'created', 'updated'])
    let models = $state([])
    let model = $state({})
    let columns = $state({})
    let schema = $state([])
    let grid = $state(true)
    let relations = $state(false)
    let err = $state('')
    let clause = $state('')
    let count = $state(0)
    let skip = $state(0)
    let take = $state(limit)
    let next = $derived(count > skip + take)
    let previous = $derived(skip !== 0)
    let first = $derived(skip > 0)
    let last = $derived(skip + take < count)
    let order = $state('')
    let sort = $state('desc')
    let qs = $derived(`${resource}?${order ? `&order=${order}&sort=${sort}` : ``}${skip ? `&skip=${skip}&take=${take}` : ``}${clause ? `&where=${clause}` : ``}`)
    let schemas = $state({})

    async function fetch(direction) {
        switch (direction) {
            case 'next':
                skip = skip + take
                break
            case 'previous':
                skip = skip - take
                break
            case 'first':
                skip = 0
                break
            case 'last':
                skip = (Math.floor(count / take)) * take
        }
        refresh((await query(qs)).json)
    }

    $effect(() => {
        if (grid) {
            err = ''
            model = {}
            relations = false
        }
        if (!grid) {
            err = ''
        }
    })

    function refresh(response) {
        count = response.count
        models = response.data
    }

    onMount(async () => {
        const response = (await query(`${qs}&schema=true`)).json
        refresh(response)
        schemas = response.schemas
        schema = schemas[resource]
        schema.forEach(s => {
            columns[s.name] = true
            if (s.kind === 'object') {
                gridHide.push(s.name)
            }
        })
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
            refresh((await query(qs)).json)
            grid = true
        } else {
            err = response.json.message
            document.forms[0].elements[0].focus()
        }
    }

    function edit(item, associations = false) {
        err = ''
        model = {...item}
        grid = false
        Object.keys(model).forEach(k => {
            const meta = schema.find(s => s.name === k)
            if (meta.type === 'DateTime' && model[k]) {
                model[k] = model[k].slice(0, -14) // format for display in datepicker
            }
        })
        relations = associations
        if (relations) {
            schema.forEach(s => {
                if (s.kind === 'object') {
                    model[s.name] = s.isList ? [] : {}
                }
            })
        }
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

    async function save(rel) {
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
        sort = sort === 'desc' ? 'asc' : 'desc'
        refresh((await query(qs)).json)
    }

    function focus() {
        grid = false
        tick().then(() => {
            document.forms[0].elements[0].focus()
        })
    }

</script>

<svelte:window on:keyup={e => {
    if (e.key === 'Escape') {
        grid = true
    }
}} on:keydown={e => {
    if (e.ctrlKey && e.key === '`') {
        focus()
    }
}}></svelte:window>

{#if grid}
    <nav>
        <ul>
            <li><h3>{capitalize(resource)}</h3><button onclick={focus}>Add</button></li>
            <li><a href="#/">Columns ▾</a>
                <ul>
                    {#each schema as col}
                        {#if col.kind !== 'object'}
                            <li><label><input type="checkbox" onclick={() => show(col.name)} bind:checked={columns[col.name]}> {col.name}</label></li>
                        {/if}
                    {/each}
                </ul>
            </li>
            <li><input type="text" placeholder="Search" bind:value={clause} onblur={async () => refresh((await query(`${qs}`)).json)}></li>
            <li><button><i class="si-search" onclick={async () => refresh((await query(`${qs}`)).json)}></i></button></li>
        </ul>
    </nav>
    <span style="color: red;">{err}</span>
    <table>
        <thead>
        <tr>
            {#each schema as col}
                {#if !gridHide.includes(col.name)}
                    <th>
                        <a href="#/" onclick={async () => await orderBy(col.name)}>{capitalize(col.name)}</a>
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
                <td><a href="#/" onclick={() => edit(item, true)}><i class="si-plus"></i></a></td>
                <td><a href="#/" onclick={() => remove(item.id)}><i class="si-trash"></i></a></td>
            </tr>
        {/each}
        </tbody>
    </table>
    {#if count > 0}
        {skip + 1}-{skip + take < count ? skip + take : count} of {count}
    {:else}
        0 Results
    {/if}
    {#if first}
        <button onclick={() => fetch('first')}><i class="si-step-backward"></i></button>
    {/if}
    {#if previous}
        <button onclick={() => fetch('previous')}><i class="si-chevron-left"></i></button>
    {/if}
    {#if next}
        <button onclick={() => fetch('next')}><i class="si-chevron-right"></i></button>
    {/if}
    {#if last}
        <button onclick={() => fetch('last')}><i class="si-step-forward"></i></button>
    {/if}
{:else if relations}
    <div class="tabs">
    {#each schema as rel}
        {#if rel.kind === 'object' && !(schemas[rel.type].find(s => s.type === resource)).isList}
            <input type="radio" name="tabs" id={rel.name} checked>
            <label for={rel.name}>{capitalize(rel.name)}</label>
            <div class="tab">
                <h4>Tab One Content</h4>
                <form>
                    {#each schemas[rel.type] as col}
                        {#if !(schemas[rel.type].find(s => s.relationFromFields &&
                            s.relationFromFields.includes(col.name))) && col.type !== resource
                            && !formHide.includes(col.name)}
                            {capitalize(col.name)}{col.isRequired && col.type !== 'Boolean' ? '*' : ''} :
                            {#if col.type === 'Boolean'}
                                <input type="checkbox" bind:checked={model[rel.name][col.name]}><p></p>
                            {:else if col.type === 'String'}
                                <input type="text" bind:value={model[rel.name][col.name]}>
                            {:else if col.type === 'Int'}
                                <input type="number" bind:value={model[rel.name][col.name]}>
                            {:else if col.type === 'Float'}
                                <input type="number" bind:value={model[rel.name][col.name]}>
                            {:else if col.type === 'DateTime'}
                                <input type="date" bind:value={model[rel.name][col.name]}>
                            {/if}
                        {/if}
                    {/each}
                    <button onclick={() => save(rel.name)}>Save</button>
                    <button onclick={() => grid = true}>Cancel</button>
                </form>
            </div>
        {/if}
    {/each}
    </div>
{:else}
    <h3>{model.id ? 'Edit' : 'Add'} {singularize(resource)}</h3>
    (* indicates required field)
    <br><span style="color: red;">{err}</span>
    <form>
        {#each schema as col}
            {#if !formHide.includes(col.name) && col.kind !== 'object'}
                <label>{capitalize(col.name)}{col.isRequired && col.type !== 'Boolean' ? '*' : ''} :
                    {#if col.type === 'Boolean'}
                        <input type="checkbox" bind:checked={model[col.name]}><p></p>
                    {:else if col.type === 'String'}
                        <input type="text" bind:value={model[col.name]}>
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
