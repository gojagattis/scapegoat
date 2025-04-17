<script>
    import {onMount} from "svelte";
    import {bearer, query, capitalize, singularize} from "$lib/common";
    import dayjs from "dayjs";
    import {browser} from "$app/environment";

    //models
    const entity = 'users'
    const singular = singularize(entity)
    let model = {}
    let inner = {}
    let models = []
    let dict = []
    let schema = []
    let lists = []
    let managed = {}
    let singles = []
    let relation = ''
    let companion = ''

    //hidden/readonly fields
    let hidden = browser && sessionStorage.getItem(entity) ? JSON.parse(sessionStorage.getItem(entity)) :
        ['id', 'creator', 'org', 'active', 'password', 'user']
    let system = ['id', 'creator', 'org', 'created', 'updated', 'user']
    let disallowed = ['password']
    const secondary = ['id', 'creator', 'org', 'active', 'password', 'user', 'created', 'updated', 'public', 'default', 'admin']
    let shown = {}

    //modals
    let upsert, confirm, assign, dependent, child;

    //infinite scroll
    let skip = 0;
    let take = $config.pageSize;
    let scrolling = false;
    let more = true;

    //filter, sort, active
    let sort = '';
    let direction = '';
    let filter = '';
    let active = true;
    $: kv = active === false ? '&active=false' : ''

    //collections
    const collections = {}
    let available = []
    let assigned = []
    let children = []
    let selected = 0

    onMount(async () => {
        schema = await query(`/${entity}/metadata`)
        models = await query(`/${entity}`)
        for (const s of schema) {
            if (s.kind === 'object') {
                hidden = [...hidden, s.name]
                system = [...system, s.name]
                disallowed = [...disallowed, s.name]
                if (!s.isList && s.type !== entity && s.relationFromFields.length === 0
                    && s.relationToFields.length === 0) {
                    const rel = await query(`/${entity}/metadata/${s.type}`)
                    const found = rel.find(r => r.relationName === s.relationName)
                    if (found && !found.isList) {
                        singles = [...singles, {[s.name]: rel}]
                    }
                }
            }
            if (s.isList) {
                const rel = await query(`/${entity}/metadata/${s.type}`)
                const found = rel.find(r => r.relationName === s.relationName)
                if (found.isList) {
                    lists = [...lists, s]
                } else if (found.relationToFields.includes('id')) {
                    managed[s.name] = rel
                }
            }
            if (schema.find(d => d.relationFromFields && d.relationFromFields.includes(s.name)
                    && d.relationToFields && d.relationToFields.includes('id'))) {
                hidden = [...hidden, s.name]
                system = [...system, s.name]
                disallowed = [...disallowed, s.name]
            }
            shown[s.name] = !hidden.includes(s.name)
        }

        setInterval(async () => {
            if (scrolling && more) {
                scrolling = false;
                const scrollTop = document.documentElement.scrollTop
                const clientHeight = document.documentElement.clientHeight
                const scrollHeight = document.documentElement.scrollHeight
                if (scrollTop + clientHeight >= scrollHeight - 100) {
                    skip = skip + take;
                    const data = await query(`/${entity}?skip=${skip}&take=${take}&sort=${sort}&direction=${direction}&value=${filter}${kv}`)
                    if (data.length === 0) {
                        more = false
                    } else {
                        models = [...models, ...data]
                    }
                }
            }
        }, 250);
    })

    function reset(all = true) {
        models = [];
        model = {};
        skip = 0;
        take = $config.pageSize;
        more = true;
        if (all) {
            sort = '';
            direction = '';
            filter = '';
            active = true;
        }
    }

    async function create() {
        Object.keys(model).forEach(k => {
            const meta = schema.find(s => s.name === k)
            if (meta.type === 'DateTime') {
                model[k] = new Date(model[k])
            }
        })
        let response = await fetch(`/${entity}`, {
            method: 'POST',
            body: JSON.stringify(model),
            headers: {
                'Authorization': bearer,
                'Content-type': 'application/json'
            }
        });
        let data = await response.json();
        if (response.ok) {
            toast(`${singular} created`, 'success');
            models = [data, ...models];
            return true;
        } else {
            toast(`${singular} create error`, 'error');
            return false
        }
    }

    async function update() {
        Object.keys(model).forEach(k => {
            const meta = schema.find(s => s.name === k)
            if (model[k] && meta && meta.type === 'DateTime') {
                model[k] = new Date(model[k])
            }
        })
        let response = await fetch(`/${entity}/${model.id}`, {
            method: 'PUT',
            body: JSON.stringify(model),
            headers: {
                'Authorization': bearer,
                'Content-type': 'application/json'
            }
        });
        let data = await response.json();
        if (response.ok) {
            toast(`${singular} updated`, 'success');
            if (active === data.active || data.active === undefined) {
                models[models.findIndex(m => m.id === model.id)] = data
            } else {
                models = models.filter(m => m.id !== model.id)
            }
            return true;
        } else {
            toast(`${singular} update error`, 'error');
            return false
        }
    }

    async function remove() {
        const response = await fetch(`/${entity}/${model.id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': bearer,
            }
        })
        if (response.ok) {
            toast(`${singular} deleted`, 'success');
            models = models.toSpliced(models.findIndex(m => m.id === model.id), 1)
            hide()
        } else {
            toast(`${singular} delete error`, 'error');
        }
    }

    function hide() {
        document.documentElement.classList.remove('modal-is-open');
        upsert.removeAttribute('open');
        confirm.removeAttribute('open');
        assign.removeAttribute('open');
        dependent.removeAttribute('open');
        child.removeAttribute('open');
    }

    async function handle() {
        let success
        if (model.id) {
            success = await update()
        } else {
            success = await create()
        }
        if (success) {
            hide()
            model = {}
            document.forms.namedItem('mutate').reset()
        }
    }

    function edit(item) {
        document.documentElement.classList.add('modal-is-open');
        upsert.setAttribute('open', '');
        model = {...item}
        Object.entries(model).forEach(([k, v]) => {
            if (Date.parse(v)) {
                model[k] = v.slice(0, -8) // format for display in datepicker
            }
        })
    }

    function add() {
        document.documentElement.classList.add('modal-is-open');
        upsert.setAttribute('open', '');
        document.forms.namedItem('mutate').elements[0].focus();
        model = {}
    }

    function showConfirm(item) {
        document.documentElement.classList.add('modal-is-open')
        confirm.setAttribute('open', '')
        model = {...item}
    }

    async function showAssign(item) {
        document.documentElement.classList.add('modal-is-open')
        assign.setAttribute('open', '')
        model = {...item}
        await manage()
    }

    async function manage(index = 0) {
        assigned = []
        available = []
        const ele = lists[index]
        available = await query(`/${ele.type}`)
        const data = await query(`/${entity}/${model.id}/${ele.name}`)
        const values = []
        data[ele.name].forEach(a => values.push(a.id))
        assigned = available.filter(a => values.includes(a.id))
        available = available.filter(a => !values.includes(a.id))
        relation = ele.name
    }

    async function showManage(item) {
        document.documentElement.classList.add('modal-is-open')
        child.setAttribute('open', '')
        model = {...item}
        await manageChildren()
    }

    function displayFields(meta) {
        for (const s of meta) {
            if (s.kind === 'object') {
                hidden = [...hidden, s.name]
                system = [...system, s.name]
                disallowed = [...disallowed, s.name]
            }
            if (meta.find(d => d.relationFromFields && d.relationFromFields.includes(s.name)
                    && d.relationToFields && d.relationToFields.includes('id'))) {
                hidden = [...hidden, s.name]
                system = [...system, s.name]
                disallowed = [...disallowed, s.name]
            }
        }
    }

    async function manageChildren(index = 0) {
        const ele = Object.keys(managed)[index]
        displayFields(Object.values(managed)[index])
        const data = await query(`/${entity}/${model.id}/${ele}`)
        children = data[ele]
        companion = ele
        selected = index
    }

    async function singleChild(structure, item) {
        dict = structure
        displayFields(dict)
        inner = item ? item : {}
        dependent.setAttribute('open', '')
    }

    function flip(item) {
        if (available.find(a => a.id === item.id)) {
            available = available.filter(a => a.id !== item.id)
            assigned = [item, ...assigned]
            model[relation] = {connect: {id: item.id}}
            update()
        } else {
            assigned = assigned.filter(a => a.id !== item.id)
            available = [item, ...available]
            model[relation] = {disconnect: {id: item.id}}
            update()
        }
    }

    function visible(field) {
        hidden = hidden.includes(field) ? hidden.filter(i => i !== field) : [...hidden, field]
        sessionStorage.setItem(entity, JSON.stringify(hidden))
    }

    async function order(field) {
        reset(false)
        if (sort !== field) {
            sort = field
            direction = 'asc'
        } else {
            direction = direction === 'asc' ? 'desc' : 'asc'
        }
        models = await query(`/${entity}?sort=${sort}&direction=${direction}&value=${filter}${kv}`)
    }

    async function search() {
        reset(false)
        models = await query(`/${entity}?value=${filter}${kv}`)
    }

    async function load(name, metadata) {
        if (!collections[name]) {
            const ref = metadata.find(s => s.relationFromFields && s.relationFromFields.includes(name))
            const data = await query(`/${ref.type}`)
            collections[name] = data.map(d => ({[ref.relationToFields[0]]: d[ref.relationToFields[0]]}))
        }

        return collections[name]
    }

    function isScalar(key, value) {
        return !secondary.includes(key) && typeof (value) !== 'object'
    }

    async function showDependent(item) {
        companion = Object.keys(item)[0]
        dict = Object.values(item)[0]
        displayFields(dict)
        model = await query(`/${entity}/${model.id}/${companion}`)
        inner = model[companion] === null ? {} : model[companion]
        dependent.setAttribute('open', '')
    }

    async function saveDependent(item = null) {
        if (item) {
            model[companion] = {
                delete: [
                    {
                        id: item.id
                    }
                ]
            }
            if (await update()) {
                children = children.toSpliced(children.findIndex(m => m.id === item.id), 1)
                dependent.removeAttribute('open')
            }
        } else {
            Object.keys(inner).forEach(k => {
                const meta = dict.find(s => s.name === k)
                if (meta.type === 'DateTime') {
                    inner[k] = new Date(inner[k])
                }
            })
            model[companion] = {
                upsert: {
                    create: inner,
                    update: inner,
                    where: {
                        id: inner.id ? inner.id : model.id //if not updating, provide any id
                    }
                },
            }
            if (await update()) {
                if (inner.id) {
                    children[children.findIndex(m => m.id === model.id)] = inner
                } else {
                    const data = await query(`/${entity}/${model.id}/${companion}`)
                    children = data[companion]
                }
                dependent.removeAttribute('open')
            }
        }
    }

</script>

<svelte:window on:keyup={e => {
    if (e.key === 'Escape') {
        hide()
    }
}} on:keydown={e => {
    if (e.ctrlKey && e.key === '`') {
        add()
    }
}} on:scroll={() => {scrolling = true}}></svelte:window>

<!--<button class="btn btn-lg btn-action s-circle bg-primary fab" on:click={add}><i class="icon icon-plus"></i></button>-->
<div class="float-right">
    <form id="search" class="form-group" on:submit|preventDefault>
        {#if schema.find(s => s.name === 'active' && s.type === 'Boolean')}
            <label class="form-switch d-inline-block c-hand">
                <input type="checkbox" bind:checked={active} on:change={search}>
                <i class="form-icon"></i> Active
            </label>
        {/if}
        <nav class="d-inline-block">
            <ul>
                <li role="list">
                    <a href="#" aria-haspopup="listbox">Columns</a>
                    <ul role="listbox">
                        {#each schema as col}
                            {#if !disallowed.includes(col.name)}
                                <li><label><input type="checkbox" on:click={() => visible(col.name)} bind:checked={shown[col.name]}> {col.name}</label></li>
                            {/if}
                        {/each}
                    </ul>
                </li>
            </ul>
        </nav>
        <div class="has-icon-right d-inline-block">
            <input class="form-input" type="text" placeholder="Search" bind:value={filter} on:keyup={() => {
                if (filter.length > 1) {
                    search()
                }
            }}>
            <i class="form-icon icon icon-cross c-hand" on:click={() => {filter = ''; document.forms.namedItem('search').elements[0].focus();}}></i>
        </div>
        <button class="btn btn-primary" type="submit" on:click={search}><i class="ic-md" data-feather="search"></i></button>
        <button class="btn btn-primary" on:click={ async () => {reset(); models = await query(`/${entity}`)}}><i class="ic-md" data-feather="rotate-cw"></i></button>
        <button class="btn btn-primary" on:click={add}><i class="ic-md" data-feather="plus"></i></button>
    </form>
</div>

<table role="grid">
    <thead>
    <tr>
        <th></th>
        {#each schema as col}
            {#if !hidden.includes(col.name)}
                <th style="white-space: nowrap; cursor: pointer"><span on:click={async () => await order(col.name)}>{capitalize(col.name)} <i style="font-size: .8rem" class="icon icon-resize-vert"></i></span></th>
            {/if}
        {/each}
        <th></th>
    </tr>
    </thead>
    <tbody>
    {#each models as item, i}
        <tr>
            <td>{i + 1}</td>
            {#each schema as col}
                {#if !hidden.includes(col.name)}
                    {#if col.type === 'DateTime'}
                        <td style="white-space: nowrap">{item[col.name] ? dayjs(item[col.name]).format('YYYY-MM-DD HH:mm') : ''}</td>
                    {:else }
                        <td style="white-space: nowrap">{item[col.name]}</td>
                    {/if}
                {/if}
            {/each}
            <td class="text-center" style="white-space: nowrap">
                <span class="mr-1" on:click={() => edit(item)}><i class="ic-md" data-feather="edit-3"></i></span>
                {#if Object.entries(managed).length}
                    <span class="mr-1" on:click={() => showManage(item)}><i class="ic-md" data-feather="layers"></i></span>
                {/if}
                {#if lists.length}
                    <span class="mr-1" on:click={() => showAssign(item)}><i class="ic-md" data-feather="arrow-right-circle"></i></span>
                {/if}
                <span class="mr-1" on:click={() => showConfirm(item)}><i class="ic-md" data-feather="trash-2"></i></span>
            </td>
        </tr>
    {/each}
    </tbody>
</table>

<dialog bind:this={upsert}>
    <article class="col-6">
        <div class="grid">
            <h3 class="mb-1">{model.id ? 'Update' : 'Add'} Record</h3>
            <div class="my-1">
                {#each singles as item, i}
                    <button class="btn btn-link" on:click={() => {showDependent(item)}}>{capitalize(Object.keys(item)[0])}</button>
                {/each}
            </div>
        </div>
        <div class="text-small mb-2">(<span class="text-error">*</span> indicates required field)</div>
        <form id="mutate" class="form-group" on:submit|preventDefault>
            {#each schema as col}
                {#if !system.includes(col.name)}
                    <label>{capitalize(col.name)}<span class="text-error">{col.isRequired && col.type !== 'Boolean' ? '*' : ''}</span> :
                        {#if col.type === 'Boolean'}
                            <label class="form-switch mb-2">
                                <input type="checkbox" bind:checked={model[col.name]}>
                                <i class="form-icon"></i>
                            </label>
                        {:else if schema.find(s => s.relationFromFields && s.relationFromFields.includes(col.name))}
                            {#await load(col.name, schema)}
                            {:then data}
                                <select bind:value={model[col.name]} class="form-select mb-2" id={col.name}>
                                    <option selected></option>
                                    {#each data as item}
                                        <option value={Object.values(item)[0]}>{Object.values(item)[0]}</option>
                                    {/each}
                                </select>
                            {/await}
                        {:else if col.type === 'String'}
                            {#if col.name.toLowerCase() === 'password'}
                                <input class="form-input mb-2" type="password" bind:value={model[col.name]}>
                            {:else}
                                <input class="form-input mb-2" type="text" bind:value={model[col.name]}>
                            {/if}
                        {:else if col.type === 'Int'}
                            <input class="form-input mb-2" type="number" bind:value={model[col.name]}>
                        {:else if col.type === 'Float'}
                            <input class="form-input mb-2" type="number" bind:value={model[col.name]}>
                        {:else if col.type === 'DateTime'}
                            <input class="form-input mb-2" type="datetime-local" bind:value={model[col.name]}>
                        {/if}
                    </label>
                {/if}
            {/each}
            <span class="d-inline-block flex-centered" style="margin-top: 2em">
                <button class="btn btn-primary mx-1" type="submit" on:click={handle}>{model.id ? 'Update' : 'Add'}</button>
                <button class="btn mx-1" on:click={hide}>Cancel</button>
            </span>
        </form>
    </article>
</dialog>

<dialog bind:this={confirm}>
    <article class="col-6">
        <div class="columns">
            <div class="col-4"><i class="ic-xl p-centered text-error" data-feather="alert-octagon"></i></div>
            <div class="col-8">
                <h3 class="mb-1">Delete {singular}?</h3>
                <div class="text-small mb-2">This is an irreversible action and cannot be undone.</div>
            </div>
        </div>
        <span class="d-inline-block flex-centered " style="margin-top: 2em">
            <button class="btn btn-primary mx-1" on:click={remove}>Delete</button>
            <button class="btn mx-1" on:click={hide}>Cancel</button>
        </span>
    </article>
</dialog>

<dialog bind:this={assign}>
    <article style="padding: 1.5rem">
        <nav class="flex-centered">
            <ul>
                <li>
                    [ {singular} :
                    {#each Object.entries(model) as [key, value]}
                        {#if isScalar(key, value)}
                            &nbsp;{value}
                        {/if}
                    {/each}
                    ]
                </li>
            </ul>
            <ul>
                {#each lists as item, i}
                    <li><a class:bg-secondary={relation === item.name} href="#" on:click={async () => await manage(i)}>{capitalize(item.name)}</a></li>
                {/each}
            </ul>
        </nav>
        <hr>
        <div style="height: 40vh; overflow-y: hidden" class="columns col-oneline">
            <div style="overflow-y: auto; overflow-x: hidden" class="col-6">
                <h4 class="text-center">Available</h4>
                {#if available}
                    <figure>
                        <table class="table table-striped table-hover">
                            {#each available as item}
                                <tr>
                                    <td><span on:click={() => flip(item)}><i class="ic-md" data-feather="arrow-right-circle"></i></span></td>
                                    {#each Object.entries(item) as [key, value]}
                                        {#if !secondary.includes(key)}
                                            <td>{value}</td>
                                        {/if}
                                    {/each}
                                </tr>
                            {/each}
                        </table>
                    </figure>
                {/if}
            </div>
            <div class="divider-vert"></div>
            <div style="overflow-y: auto; overflow-x: hidden" class="col-6">
                <h4 class="text-center">Assigned</h4>
                {#if assigned}
                    <figure>
                        <table class="table table-striped table-hover">
                            {#each assigned as item}
                                <tr>
                                    <td><span on:click={() => flip(item)}><i class="ic-md" data-feather="arrow-left-circle"></i></span></td>
                                    {#each Object.entries(item) as [key, value]}
                                        {#if !secondary.includes(key)}
                                            <td>{value}</td>
                                        {/if}
                                    {/each}
                                </tr>
                            {/each}
                        </table>
                    </figure>
                {/if}
            </div>
        </div>
        <span class="d-inline-block flex-centered " style="margin-top: 2em">
            <button class="btn btn-primary mx-1" on:click={hide}>Close</button>
            <!--            <button class="btn mx-1" on:click={hide}>Cancel</button>-->
        </span>
    </article>
</dialog>

<dialog bind:this={child}>
    <article>
        <nav>
            <ul>
                {#each Object.keys(managed) as item, i}
                    <li><a class:bg-secondary={companion === item.name} href="#" on:click={async () => await manageChildren(i)}>{capitalize(item)}</a></li>
                {/each}
            </ul>
            <ul>
                <li><button class="btn btn-link" on:click={() => singleChild(Object.values(managed)[selected], null)}>Add</button></li>
            </ul>
        </nav>
        {#if Object.values(managed)[selected]}
            <table role="grid">
                <thead>
                <tr>
                    {#each Object.values(managed)[selected] as col}
                        {#if !hidden.includes(col.name)}
                            <th>{capitalize(col.name)}</th>
                        {/if}
                    {/each}
                    <th></th>
                </tr>
                </thead>
                <tbody>
                {#if children.length}
                    {#each children as item}
                        <tr>
                            {#each Object.values(managed)[selected] as col}
                                {#if !hidden.includes(col.name)}
                                    {#if col.type === 'DateTime'}
                                        <td>{dayjs(item[col.name]).format('YYYY-MM-DD HH:mm')}</td>
                                    {:else }
                                        <td>{item[col.name]}</td>
                                    {/if}
                                {/if}
                            {/each}
                            <td class="text-center">
                                <span class="mr-1" on:click={() => singleChild(Object.values(managed)[selected], item)}><i class="ic-md" data-feather="edit-3"></i></span>
                                <span class="mr-1" on:click={() => saveDependent(item)}><i class="ic-md" data-feather="trash-2"></i></span>
                            </td>
                        </tr>
                    {/each}
                {/if}
                </tbody>
            </table>
        {/if}
        <span class="d-inline-block flex-centered" style="margin-top: 2em">
            <button class="btn mx-1" on:click={hide}>Close</button>
        </span>
    </article>
</dialog>

<dialog bind:this={dependent}>
    <article class="col-6">
        <div class="grid">
            <h3 class="mb-1">{capitalize(companion)}</h3>
        </div>
        <div class="text-small mb-2">(<span class="text-error">*</span> indicates required field)</div>
        <form id="substrate" class="form-group" on:submit|preventDefault>
            {#each dict as col}
                {#if !system.includes(col.name)}
                    <label>{capitalize(col.name)}<span
                            class="text-error">{col.isRequired && col.type !== 'Boolean' ? '*' : ''}</span> :
                        {#if col.type === 'Boolean'}
                            <label class="form-switch mb-2">
                                <input type="checkbox" bind:checked={inner[col.name]}>
                                <i class="form-icon"></i>
                            </label>
                        {:else if dict.find(s => s.relationFromFields && s.relationFromFields.includes(col.name))}
                            {#await load(col.name, dict)}
                            {:then data}
                                <select bind:value={inner[col.name]} class="form-select mb-2" id={col.name}>
                                    <option selected></option>
                                    {#each data as item}
                                        <option value={Object.values(item)[0]}>{Object.values(item)[0]}</option>
                                    {/each}
                                </select>
                            {/await}
                        {:else if col.type === 'String'}
                            {#if col.name.toLowerCase() === 'password'}
                                <input class="form-input mb-2" type="password" bind:value={inner[col.name]}>
                            {:else}
                                <input class="form-input mb-2" type="text" bind:value={inner[col.name]}>
                            {/if}
                        {:else if col.type === 'Int'}
                            <input class="form-input mb-2" type="number" bind:value={inner[col.name]}>
                        {:else if col.type === 'Float'}
                            <input class="form-input mb-2" type="number" bind:value={inner[col.name]}>
                        {:else if col.type === 'DateTime'}
                            <input class="form-input mb-2" type="datetime-local" bind:value={inner[col.name]}>
                        {/if}
                    </label>
                {/if}
            {/each}
            <span class="d-inline-block flex-centered" style="margin-top: 2em">
                <button class="btn btn-primary mx-1" type="submit" on:click={() => saveDependent()}>Update</button>
                <button class="btn mx-1" on:click={() => dependent.removeAttribute('open')}>Cancel</button>
            </span>
        </form>
    </article>
</dialog>
