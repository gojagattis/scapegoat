<script>
    import { onMount, tick } from 'svelte';
    import { query, capitalize, singularize, limit, mutate } from '$lib/common';
    import dayjs from "dayjs";
    import { page } from '$app/stores';
    import { page as current } from '$app/state';
    import {browser} from "$app/environment";
    import { goto, replaceState } from '$app/navigation';
    import { permissions } from '$lib/common.svelte.js';

    const resource = current.url.pathname.slice(1)
    const operations = ['create', 'update', 'delete', 'connect', 'disconnect']
    const perms = $state([])
    let gridHide = $state(browser && localStorage.getItem(resource) ? JSON.parse(localStorage.getItem(resource)) : ['id', 'creator', 'created'])
    let formHide = $state(['id', 'creator', 'created', 'updated'])
    let models = $state([])
    let model = $state({})
    let columns = $state({})
    let schema = $state([])
    let grid = $state(true)
    let key = $state(0)
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
    let master = $state({})
    let connect = $state({})
    let params = $state()
    let checked = 'checked'
    let disabled = $derived(perms.includes('update') ? '' : 'disabled')
    let submitted = $state(false)
    let edited = $state(false)
    let deleted = $state(false)
    let depth = $derived.by(() => {
        let depth = -1
        if (submitted && edited && deleted) {
            depth = -4
        } else if((submitted && edited) || (submitted && deleted) || (edited && deleted)) {
            depth = -3
        } else if (submitted || edited || deleted) {
            depth = -2
        }
        return depth
    })

    export const snapshot = {
        capture: () => {
            $page.url.searchParams.set('serialized', true);
            replaceState($page.url, $page.state);
            return {gridHide, formHide, models, model, columns, schema, grid, clause, count, skip, order, sort, schemas, master, connect}
        },
        restore: (data) => {
            gridHide  = data.gridHide
            formHide = data.formHide
            models = data.models
            model = data.model
            columns = data.columns
            schema = data.schema
            grid = data.grid
            clause = data.clause
            count = data.count
            skip = data.skip
            order = data.order
            sort = data.sort
            schemas = data.schemas
            master = data.master
            connect = data.connect
            $page.url.searchParams.delete('serialized')
            replaceState($page.url, $page.state);
        }
    }

    function once() {
        checked = ''
    }

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
            checked = 'checked'
        }
        if (!grid) {
            err = ''
        }
    })

    $effect(() => {
        if (key) {
            err = ''
        }
    })

    function refresh(response) {
        count = response.count
        models = response.data
    }

    onMount(async () => {
        permissions.filter(p => p.resource === resource).forEach(f => {
            if (f.action.startsWith('create:')) {
                perms.push('create')
            } else if (f.action.startsWith('delete:')) {
                perms.push('delete')
            } else if (f.action.startsWith('update:')) {
                perms.push('update')
            } else if (f.action.startsWith('read:')) {
                perms.push('read')
            }
        })
        params = current.url.searchParams
        clause = params.get('where')
        if (!params.get('serialized')) {
            const response = (await query(`${qs}&schema=true`)).json
            refresh(response)
            schemas = response.schemas
            schema = schemas[resource]
            const upper = schema.findIndex(s => s.name === 'id')
            const lower = schema.findIndex(s => s.name === 'updated')
            schema.forEach((s, i) => {
                columns[s.name] = true
                if (s.kind === 'object' || schema.filter(f => f.relationFromFields && f.relationFromFields.includes(s.name)).length > 0) {
                    gridHide.push(s.name)
                }
                if (i > lower || i < upper || schema.filter(f => f.relationFromFields && f.relationFromFields.includes(s.name)).length > 0
                  || (s.relationOnDelete === 'Cascade' && s.relationToFields.includes('id'))) {
                    formHide.push(s.name)
                }
            })
            gridHide.forEach(col => columns[col] = false)
            for (const [k, v] of Object.entries(schemas)) {
                if (k !== resource) {
                    const node = v.find(s => s.type === resource)
                    if (node.isList && schema.findIndex(f => f.relationName === node.relationName) > upper) {
                        master[k] = (await query(k)).json.data
                    }
                }
            }
        }
    })

    async function add(nest = false) {
        submitted = true
        const clone = JSON.parse(JSON.stringify(model))
        const data = {}
        schema.filter(s => s.type === 'DateTime').forEach(d => {
            if (model[d.name]) {
                model[d.name] = new Date(model[d.name])
            }
        })
        Object.keys(connect).forEach(n => {
            if (Array.isArray(model[n])) {
                Object.entries(connect[n]).forEach(([k, v]) => {
                    if (v && !model[n].find(m => m.id === k)) {
                        if (!data[n]) {
                            data[n] = {
                                connect: []
                            }
                        } else if (!data[n].connect) {
                            data[n].connect = []
                        }
                        data[n].connect.push({ id: k });
                    } else if (!v && model[n].find(m => m.id === k)) {
                        if (!data[n]) {
                            data[n] = {
                                disconnect: []
                            }
                        } else if (!data[n].disconnect) {
                            data[n].disconnect = []
                        }
                        data[n].disconnect.push({id: k})
                    }
                });
            } else {
                if (connect[n].id && (!model[n].id || connect[n].id !== model[n].id)) {
                    data[n] = {
                        connect: {
                            id: connect[n].id
                        }
                    }
                } else if (connect[n].id === '' && model[n] && model[n].id) {
                    data[n] = {
                        disconnect: true
                    }
                }
            }
            if (nest) {
                model[n] = data[n]
                delete data[n]
            }
        })

        const fk = params.get('where')
        if (fk) {
            const terms = fk.split(',')
            model[schema.find(k => k.relationFromFields && k.relationFromFields.includes(terms[0])).name] = {
                connect: {
                    id: terms[2]
                }
            }
        }

        Object.keys(model).forEach(k => {
            if ((Array.isArray(model[k]) && (model[k].length === 0 || Object.keys(model[k][0]).length === 0))
              || (model[k] && typeof model[k] === 'object' && !Object.keys(model[k]).every(e => operations.includes(e)))
              || schema.filter(f => f.relationFromFields && f.relationFromFields.includes(k)).length > 0) {
                delete model[k]
            }
        })

        const response = await mutate(`${resource}/${model.id ?? ''}`, Object.keys(data).length > 0 ? data : model, model.id ? 'PUT' : 'POST');
        if (response.ok) {
            err = ''
            if (!model.id) {
                model = {};
                models = [response.json, ...models];
                grid = true;
            } else {
                schema.filter(s => s.type === 'DateTime').forEach(d => {
                    if (model[d.name]) {
                        model[d.name] = dayjs(model[d.name]).format('YYYY-MM-DD')
                    }
                })
                models[models.findIndex(m => m.id === model.id)] = response.json
                model = clone
            }
        } else {
            schema.filter(s => s.type === 'DateTime').forEach(d => {
                if (model[d.name]) {
                    model[d.name] = dayjs(model[d.name]).format('YYYY-MM-DD')
                }
            })
            err = response.json.message
            if (!model.id) {
                document.forms[0].elements[0].focus()
            }
        }
    }

    async function edit(item) {
        edited = true
        err = ''
        model = { ...item }

        const map = {}
        schema.forEach(s => {
            if (s.kind === 'object' && schemas[s.type].find(f => f.relationName === s.relationName).isList) {
                map[s.name] = s.type
            }
        })
        if (map) {
            model = (await query(`${resource}/${model.id}?include=${Object.keys(map).join(',')}`)).json
            Object.entries(map).forEach(([k, v]) => {
                if (model[k] === null) {
                    model[k] = {}
                }
                if (Array.isArray(model[k]) && model[k].length === 0) {
                    model[k].push({})
                }
                if ((schemas[v].find(s => s.type === resource)).isList) {
                    connect[k] = {};
                    if (master[v] && Array.isArray(model[k])) {
                        master[v].forEach(m => connect[k][m.id] = !!model[k].find(s => s.id === m.id));
                    } else {
                        connect[k] = {
                            id: model[k].id ?? ''
                        }
                    }
                }
                schemas[v].filter(s => s.type === 'DateTime').forEach(d => {
                    if (model[k][d.name]) {
                        model[k][d.name] = dayjs(model[k][d.name]).format('YYYY-MM-DD')
                    }
                })
            })
        }

        schema.filter(s => s.type === 'DateTime').forEach(d => {
            if (model[d.name]) {
                model[d.name] = dayjs(model[d.name]).format('YYYY-MM-DD')
            }
        })
        grid = false
    }

    async function remove(id, name = null, route = resource, index = null) {
        deleted = true
        if (!id) {
            return
        }
        if (index !== null && !id) {
            model[name].splice(index, 1);
            if (model[name].length === 0) {
                model[name].push({})
            }
            key++;
            return;
        }
        const response = await query(`${route}/${id}`, 'DELETE');
        if (response.ok) {
            err = ''
            if (route === resource) {
                models.splice(models.findIndex(m => m.id === id), 1)
            } else if (!Array.isArray(model[name])) {
                model[name] = {}
            } else if (Array.isArray(model[name])) {
                model[name].splice(model[name].findIndex(m => m.id === id), 1)
                if (model[name].length === 0) {
                    model[name].push({})
                }
            }
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
        schema.forEach((s) => {
            if (s.kind === 'object') {
                model[s.name] = s.isList ? [{}] : {}
                if ((schemas[s.type].find(f => f.type === resource)).isList) {
                    connect[s.name] = {}
                }
            }
        })
        grid = false
        tick().then(() => {
            document.forms[0].elements[0].focus()
        })
    }

    function navigate(rel) {
        const node = schemas[rel.type].find(s => s.relationName === rel.relationName)
        if (!node.isList) {
            goto(`/${rel.type}?where=${node.relationFromFields[0]},equals,${model[node.relationToFields[0]]}`)
        }
        key++
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
            {#if params && params.get('where')}
                <button onclick={() => history.go(depth)}>Back</button>
            {/if}
            <li><h3>{capitalize(resource)}</h3>
                {#if perms.includes('create')}
                    <button onclick={focus}>Add</button>
                {/if}
            </li>
            <li><a href="#/">Columns ▾</a>
                <ul>
                    {#each schema as col}
                        {#if col.kind !== 'object' && schema.filter(f => f.relationFromFields && f.relationFromFields.includes(col.name)).length === 0}
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
                <td><a href="#/" onclick={() => edit(item)}><i class={perms.includes('update') ? 'si-edit' : 'si-eye'}></i></a></td>
                <td>
                    {#if perms.includes('delete')}
                        <a href="#/" onclick={() => remove(item.id)}><i class="si-trash"></i></a>
                    {/if}
                </td>
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
{:else}
    <div class="tabs">
        {#if params && params.get('where')}
            <input type="radio" name="tabs" id="{params.get('where').split(',')[0]}">
            <label onclick={() => history.go(depth)} for={params.get('where').split(',')[0]}>{capitalize(params.get('where').split(',')[0])}</label>
            <div class="tab">
            </div>
        {/if}
        <input type="radio" name="tabs" id={resource} {checked}>
        <label onclick={() => key++} for={resource}>{singularize(resource)}</label>
        <div class="tab">
            (* indicates required field)
            <br><span style="color: red;">{err}</span>
            <br>
            <form>
                <fieldset {disabled}>
                    {#each schema as rel}
                        {#if !formHide.includes(rel.name) && schema.findIndex(s => s.name === rel.name) <= schema.findIndex(s => s.name === 'updated')}
                            {capitalize(rel.name)}{rel.isRequired && rel.type !== 'Boolean' && rel.kind !== 'object' ? '*' : ''} :
                            {#if rel.type === 'Boolean'}
                                <input type="checkbox" bind:checked={model[rel.name]}><p></p>
                            {:else if rel.type === 'String'}
                                <input type="text" bind:value={model[rel.name]}>
                            {:else if rel.type === 'Int'}
                                <input type="number" bind:value={model[rel.name]}>
                            {:else if rel.type === 'Float'}
                                <input type="number" step="any" bind:value={model[rel.name]}>
                            {:else if rel.type === 'DateTime'}
                                <input type="date" bind:value={model[rel.name]}>
                            {:else if rel.kind === 'object' && (schemas[rel.type].find(s => s.type === resource)).isList}
                                <br>
                                {#if rel.isList}
                                    <table>
                                        <thead>
                                        <tr>
                                            <th></th>
                                            {#each schemas[rel.type] as col}
                                                {#if !gridHide.includes(col.name) && col.kind !== 'object' && col.name !== 'updated'}
                                                    <th>{capitalize(col.name)}</th>
                                                {/if}
                                            {/each}
                                        </tr>
                                        </thead>
                                        <tbody>
                                        {#each master[rel.type] as item}
                                            <tr>
                                                <td><input type="checkbox" bind:checked={connect[rel.name][item.id]}></td>
                                                {#each schemas[rel.type] as col}
                                                    {#if !gridHide.includes(col.name) && col.name !== 'updated'}
                                                        {#if col.type === 'DateTime'}
                                                            <td>{item[col.name] ? item[col.name].endsWith('T00:00:00.000Z') ? dayjs(item[col.name]).format('YYYY-MM-DD') : dayjs(item[col.name]).format('YYYY-MM-DD HH:mm') : ''}</td>
                                                        {:else if col.type === 'Boolean'}
                                                            {#if item[col.name]}
                                                                <td><i class="si-check"></i></td>
                                                            {:else}
                                                                <td><i class="si-x"></i></td>
                                                            {/if}
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
                                    <select bind:value={connect[rel.name].id}>
                                        <option selected></option>
                                        {#each master[rel.type] as item}
                                            <option value={item.id}>{item.name}</option>
                                        {/each}
                                    </select>
                                {/if}
                                <br>
                            {/if}
                        {/if}
                    {/each}
                </fieldset>
                {#if perms.includes('create') && !model.id}
                    <button onclick={() => add(true)}>Create</button>
                {:else if perms.includes('update') && model.id}
                    <button onclick={() => add(true)}>Update</button>
                {/if}
                <button onclick={() => grid = true}>Back</button>
            </form>
        </div>
        {#each schema as rel}
            {#if rel.kind === 'object' && schema.findIndex(s => s.name === rel.name) > schema.findIndex(s => s.name === 'updated')}
                <input type="radio" name="tabs" id={rel.name} {checked}>
                <label onclick={() => navigate(rel)} for={rel.name}>{capitalize(rel.name)}</label>
                <div class="tab">
                    (* indicates required field)
                    {#key key}
                        {#if rel.isList && !(schemas[rel.type].find(s => s.type === resource)).isList}

                        {:else if !rel.isList && !(schemas[rel.type].find(s => s.type === resource)).isList}

                        {:else if (schemas[rel.type].find(s => s.type === resource)).isList}
                            <br>
                            <table>
                                <thead>
                                <tr>
                                    <th></th>
                                    {#each schemas[rel.type] as col}
                                        {#if !gridHide.includes(col.name) && col.kind !== 'object' && col.name !== 'updated'}
                                            <th>{capitalize(col.name)}</th>
                                        {/if}
                                    {/each}
                                </tr>
                                </thead>
                                <tbody>
                                {#each master[rel.type] as item}
                                    <tr>
                                        {#if rel.isList}
                                            <td><input type="checkbox" bind:checked={connect[rel.name][item.id]}></td>
                                        {:else}
                                            <td><input style="display: initial" type="radio" value={item.id} bind:group={connect[rel.name].id}></td>
                                        {/if}
                                        {#each schemas[rel.type] as col}
                                            {#if !gridHide.includes(col.name) && col.name !== 'updated'}
                                                {#if col.type === 'DateTime'}
                                                    <td>{item[col.name] ? item[col.name].endsWith('T00:00:00.000Z') ? dayjs(item[col.name]).format('YYYY-MM-DD') : dayjs(item[col.name]).format('YYYY-MM-DD HH:mm') : ''}</td>
                                                {:else if col.type === 'Boolean'}
                                                    {#if item[col.name]}
                                                        <td><i class="si-check"></i></td>
                                                    {:else}
                                                        <td><i class="si-x"></i></td>
                                                    {/if}
                                                {:else }
                                                    <td>{item[col.name]}</td>
                                                {/if}
                                            {/if}
                                        {/each}
                                    </tr>
                                {/each}
                                </tbody>
                            </table>
                            <button onclick={() => add()}>Save</button>
                            <button onclick={() => grid = true}>Cancel</button>
                        {/if}
                    {/key}
                </div>
            {/if}
            {void once() ?? ''}
        {/each}
    </div>
{/if}

<style>
    h3, nav {
        display: inline;
    }
    fieldset {
        border: none;
    }
</style>
