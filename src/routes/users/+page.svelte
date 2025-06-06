<script>
    import { onMount, tick } from 'svelte';
    import { query, capitalize, singularize, limit, mutate } from '$lib/common';
    import dayjs from "dayjs";
    import { page } from '$app/state';
    import {browser} from "$app/environment";

    const resource = page.url.pathname.slice(1)
    let gridHide = $state(browser && localStorage.getItem(resource) ? JSON.parse(localStorage.getItem(resource)) : ['id', 'password', 'creator', 'created'])
    const formHide = $state(['id', 'creator', 'created', 'updated'])
    let models = $state([])
    let model = $state({})
    let columns = $state({})
    let schema = $state([])
    let grid = $state(true)
    let key = $state(0)
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
    let master = $state({})
    let connect = $state({})
    let checked = 'checked'

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
            relations = false
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
        const response = (await query(`${qs}&schema=true`)).json
        refresh(response)
        schemas = response.schemas
        schema = schemas[resource]
        const final = schema.findIndex(s => s.name === 'updated')
        schema.forEach((s, i) => {
            columns[s.name] = true
            if (s.kind === 'object' || schema.filter(f => f.relationFromFields && f.relationFromFields.includes(s.name)).length > 0) {
                gridHide.push(s.name)
            }
            if (i > final) {
                formHide.push(s.name)
            }
        })
        gridHide.forEach(col => columns[col] = false)
        for (const [k, v] of Object.entries(schemas)) {
            if (k !== resource && v.find(s => s.type === resource).isList) {
                master[k] = (await query(k)).json.data
            }
        }
    })

    async function add(nest = false) {
        const data = {}
        schema.filter(s => s.type === 'DateTime').forEach(d => {
            if (model[d.name]) {
                model[d.name] = new Date(model[d.name])
            }
        })
        Object.keys(connect).forEach(n => {
            if (Array.isArray(model[n])) {
                data[n] = {
                    disconnect: [],
                    connect: []
                }
                Object.entries(connect[n]).forEach(([k, v]) => {
                    if (v) {
                        data[n].connect.push({ id: k });
                    } else {
                        data[n].disconnect.push({id: k})
                    }
                })
            } else {
                if (model[n] && model[n].id) {
                    data[n] = {
                        connect: {
                            id: model[n].id
                        }
                    }
                }
            }
            if (nest) {
                model[n] = data[n]
                delete data[n]
            }
        })

        Object.keys(model).forEach(k => {
            if ((Array.isArray(model[k]) && (model[k].length === 0 || Object.keys(model[k][0]).length === 0))
              || (typeof model[k] === 'object' && Object.keys(model[k]).length === 0)
              || schema.filter(f => f.relationFromFields && f.relationFromFields.includes(k)).length > 0) {
                delete model[k]
            }
        })
        const keys = Object.keys(data).length > 0
        const response = await mutate(`${resource}/${model.id ?? ''}`, keys ? data : model, model.id ? 'PUT' : 'POST');
        if (response.ok) {
            err = ''
            if (!keys) {
                model = {}
                refresh((await query(qs)).json)
                grid = true
            }
        } else {
            err = response.json.message
            if (!keys) {
                document.forms[0].elements[0].focus()
            }
        }
    }

    async function edit(item, associations = false) {
        err = ''
        model = { ...item }
        relations = associations

        const map = {}
        schema.forEach(s => {
            if (s.kind === 'object') {
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
                    connect[k] = {}
                    if (Array.isArray(model[k])) {
                        master[v].forEach(m => connect[k][m.id] = !!model[k].find(s => s.id === m.id))
                    }
                }
                schemas[v].filter(s => s.type === 'DateTime').forEach(d => {
                    if (model[k][d.name]) {
                        model[k][d.name] = model[k][d.name].slice(0, -14)
                    }
                })
            })
        }

        schema.filter(s => s.type === 'DateTime').forEach(d => {
            if (model[d.name]) {
                model[d.name] = model[d.name].slice(0, -14)
            }
        })
        grid = false
    }

    async function remove(id, name = null, route = resource, index = null) {
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

    async function save(node, name, type, index = null) {
        schemas[type].filter(s => s.type === 'DateTime').forEach(d => {
            if (node[d.name]) {
                node[d.name] = new Date(node[d.name])
            }
        })
        const ref = schemas[type].find(s => s.kind === 'object' && s.type === resource && !s.isList && s.isRequired)
        if (ref) {
            node[ref.relationFromFields] = model.id
        }
        const response = await mutate(`${type}/${node['id'] ?? ''}`, node, node['id'] ? 'PUT' : 'POST');
        if (response.ok) {
            const resp = response.json
            schemas[type].filter(s => s.type === 'DateTime').forEach(d => {
                if (resp[d.name]) {
                    resp[d.name] = resp[d.name].slice(0, -14)
                }
            })
            if (schema.find(s => s.name === name).isList) {
                model[name][index ?? 0] = resp
            } else {
                model[name] = resp
            }
            err = '';
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
                        {#if col.kind !== 'object' && col.name !== 'password' && schema.filter(f => f.relationFromFields && f.relationFromFields.includes(col.name)).length === 0}
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
        {#if rel.kind === 'object' && schema.findIndex(s => s.name === rel.name) > schema.findIndex(s => s.name === 'updated')}
            <input type="radio" name="tabs" id={rel.name} {checked}>
            <label onclick={() => key++} for={rel.name}>{capitalize(rel.name)}</label>
            <div class="tab">
                (* indicates required field)
                {#if model[rel.name][0] && Object.keys(model[rel.name][0]).includes('id') && !(schemas[rel.type].find(s => s.type === resource)).isList}
                    <button onclick={() => model[rel.name].unshift({})}>Add another</button>
                {/if}
                <br><span style="color: red;">{err}</span>
                {#key key}
                    {#if rel.isList && !(schemas[rel.type].find(s => s.type === resource)).isList}
                        {#each model[rel.name] as item, i}
                            <br>
                            <fieldset>
                                <form>
                                    {#each schemas[rel.type] as col}
                                        {#if !(schemas[rel.type].find(s => s.relationFromFields &&
                                          s.relationFromFields.includes(col.name))) && col.type !== resource
                                        && !formHide.includes(col.name)}
                                            {capitalize(col.name)}{col.isRequired && col.type !== 'Boolean' ? '*' : ''} :
                                            {#if col.type === 'Boolean'}
                                                <input type="checkbox" bind:checked={model[rel.name][i][col.name]}><p></p>
                                            {:else if col.type === 'String'}
                                                <input type="text" bind:value={model[rel.name][i][col.name]}>
                                            {:else if col.type === 'Int'}
                                                <input type="number" bind:value={model[rel.name][i][col.name]}>
                                            {:else if col.type === 'Float'}
                                                <input type="number" bind:value={model[rel.name][i][col.name]}>
                                            {:else if col.type === 'DateTime'}
                                                <input type="date" bind:value={model[rel.name][i][col.name]}>
                                            {/if}
                                        {/if}
                                    {/each}
                                    <button onclick={() => save(model[rel.name][i], rel.name, rel.type, [i])}>Save</button>
                                    <button onclick={() => remove(model[rel.name][i]['id'], rel.name, rel.type, i)}>Delete</button>
                                    <button onclick={() => grid = true}>Cancel</button>
                                </form>
                            </fieldset>
                        {/each}
                    {:else if !rel.isList && !(schemas[rel.type].find(s => s.type === resource)).isList}
                        <br>
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
                            <button onclick={() => save(model[rel.name], rel.name, rel.type)}>Save</button>
                            <button onclick={() => remove(model[rel.name]['id'], rel.name, rel.type)}>Delete</button>
                            <button onclick={() => grid = true}>Cancel</button>
                        </form>
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
                                        <td><input style="display: initial" type="radio" value={item.id} bind:group={model[rel.name].id}></td>
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
            {void once() ?? ''}
        {/if}
    {/each}
    </div>
{:else}
    <h3>{model.id ? 'Edit' : 'Add'} {singularize(resource)}</h3>
    (* indicates required field)
    <br><span style="color: red;">{err}</span>
    <br>
    <form>
        {#each schema as rel}
            {#if !formHide.includes(rel.name) && schema.findIndex(s => s.name === rel.name) <= schema.findIndex(s => s.name === 'updated')}
                <label>{capitalize(rel.name)}{rel.isRequired && rel.type !== 'Boolean' && rel.kind !== 'object' ? '*' : ''} :
                    {#if rel.type === 'Boolean'}
                        <input type="checkbox" bind:checked={model[rel.name]}><p></p>
                    {:else if rel.type === 'String'}
                        {#if rel.name === 'password'}
                            <input type="password" bind:value={model[rel.name]}>
                        {:else}
                            <input type="text" bind:value={model[rel.name]}>
                        {/if}
                    {:else if rel.type === 'Int'}
                        <input type="number" bind:value={model[rel.name]}>
                    {:else if rel.type === 'Float'}
                        <input type="number" bind:value={model[rel.name]}>
                    {:else if rel.type === 'DateTime'}
                        <input type="date" bind:value={model[rel.name]}>
                    {:else if rel.kind === 'object'}
                        {#if rel.isList && !(schemas[rel.type].find(s => s.type === resource)).isList}
                            {#each model[rel.name] as item, i}
                                <br>
                                <fieldset>
                                    <form>
                                        {#each schemas[rel.type] as col}
                                            {#if !(schemas[rel.type].find(s => s.relationFromFields &&
                                              s.relationFromFields.includes(col.name))) && col.type !== resource
                                            && !formHide.includes(col.name)}
                                                {capitalize(col.name)}{col.isRequired && col.type !== 'Boolean' ? '*' : ''} :
                                                {#if col.type === 'Boolean'}
                                                    <input type="checkbox" bind:checked={model[rel.name][i][col.name]}><p></p>
                                                {:else if col.type === 'String'}
                                                    <input type="text" bind:value={model[rel.name][i][col.name]}>
                                                {:else if col.type === 'Int'}
                                                    <input type="number" bind:value={model[rel.name][i][col.name]}>
                                                {:else if col.type === 'Float'}
                                                    <input type="number" bind:value={model[rel.name][i][col.name]}>
                                                {:else if col.type === 'DateTime'}
                                                    <input type="date" bind:value={model[rel.name][i][col.name]}>
                                                {/if}
                                            {/if}
                                        {/each}
                                        <button onclick={() => save(model[rel.name][i], rel.name, rel.type, [i])}>Save</button>
                                        <button onclick={() => remove(model[rel.name][i]['id'], rel.name, rel.type, i)}>Delete</button>
                                        <button onclick={() => grid = true}>Cancel</button>
                                    </form>
                                </fieldset>
                            {/each}
                        {:else if !rel.isList && !(schemas[rel.type].find(s => s.type === resource)).isList}
                            <br>
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
                                <button onclick={() => save(model[rel.name], rel.name, rel.type)}>Save</button>
                                <button onclick={() => remove(model[rel.name]['id'], rel.name, rel.type)}>Delete</button>
                                <button onclick={() => grid = true}>Cancel</button>
                            </form>
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
                                            <td><input style="display: initial" type="radio" value={item.id} bind:group={model[rel.name].id}></td>
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
                        {/if}
                    {/if}
                </label>
            {/if}
        {/each}
        <button onclick={() => add(true)}>{model.id ? 'Edit' : 'Add'}</button>
        <button onclick={() => grid = true}>Cancel</button>
    </form>
{/if}

<style>
    h3, nav {
        display: inline;
    }
</style>
