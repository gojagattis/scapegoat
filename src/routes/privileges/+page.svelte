<script>
    import {onMount} from "svelte";
    import {bearer, query} from "$lib/common";

    let roles = []
    let resources = []
    let permissions = []
    let selected = {}
    let role

    //modals
    let confirm

    onMount(async () => {
        roles = await query(`/roles`)
        resources = await query(`/resources`)
    })

    async function load() {
        Array.from(document.getElementsByClassName('radio')).forEach(e => e.checked = false)
        selected = {}
        permissions = []
        if (role) {
            const data = await query(`/roles/${role}/permissions`)
            permissions = data.permissions
            permissions.forEach(p => {
                selected[`${p.resource}:${p.action.split(':')[0]}`] = p.action.split(':')[1]
            })
        }
    }

    async function update(key, value) {
        const tokens = key.split(':')
        if (selected.hasOwnProperty(key)) {
            const perm = permissions.find(p => p.resource === tokens[0] && p.action.startsWith(tokens[1]))
            if (value === 'none') {
                const response = await fetch(`/permissions/${perm.id}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': bearer,
                    }
                })
                if (response.ok) {
                    permissions = permissions.filter(p => p.id !== perm.id)
                    delete selected[key]
                }
            } else {
                perm.action = `${tokens[1]}:${value}`
                await fetch(`/permissions/${perm.id}`, {
                    method: 'PUT',
                    body: JSON.stringify(perm),
                    headers: {
                        'Authorization': bearer,
                        'Content-type': 'application/json'
                    }
                })
            }
        } else if (value === 'own' || value === 'any') {
            const perm = {
                role: roles.find(r => r.id === role).name,
                resource: tokens[0],
                action: `${tokens[1]}:${value}`
            }
            const response = await fetch(`/permissions`, {
                method: 'POST',
                body: JSON.stringify(perm),
                headers: {
                    'Authorization': bearer,
                    'Content-type': 'application/json'
                }
            })
            let data = await response.json()
            if (response.ok) {
                permissions = [...permissions, data]
                selected[key] = value
            }
        }
    }

    function hide() {
        document.documentElement.classList.remove('modal-is-open');
        confirm.removeAttribute('open');
    }

</script>

<svelte:window on:keyup={e => {
    if (e.key === 'Escape') {
        hide()
    }
}}></svelte:window>

<span class="d-inline-block">
    <select bind:value={role} class="form-select" on:change={load}>
    <option value="">Select Role...</option>
        {#each roles as item}
        <option value={item.id}>{item.name}</option>
    {/each}
</select>
</span>

<table>
    <thead>
    <tr>
        <th>Resource</th>
        <th>Create</th>
        <th>View</th>
        <th>Edit</th>
        <th>Delete</th>
    </tr>
    </thead>
    <tbody>
        {#each resources as item}
            <tr>
                <td>{item}</td>
                <td>
                    <label class="form-radio">
                        <input class="radio" type="radio" on:click={() => update(`${item}:create`, `none`)} name={`${item}:create`} value="none" disabled={!role}>
                        <i class="form-icon"></i> None
                    </label>
                    <label class="form-radio">
                        <input type="radio" on:click={() => update(`${item}:create`, `own`)} bind:group={selected[`${item}:create`]} name={`${item}:create`} value="own" disabled={!role}>
                        <i class="form-icon"></i> Own
                    </label>
                    <label class="form-radio">
                        <input type="radio" on:click={() => update(`${item}:create`, 'any')} bind:group={selected[`${item}:create`]} name={`${item}:create`} value="any" disabled={!role}>
                        <i class="form-icon"></i> Any
                    </label>
                </td>
                <td>
                    <label class="form-radio">
                        <input class="radio" type="radio" on:click={() => update(`${item}:read`, `none`)} name={`${item}:read`} value="none" disabled={!role}>
                        <i class="form-icon"></i> None
                    </label>
                    <label class="form-radio">
                        <input type="radio" on:click={() => update(`${item}:read`, `own`)} bind:group={selected[`${item}:read`]} name={`${item}:read`} value="own" disabled={!role}>
                        <i class="form-icon"></i> Own
                    </label>
                    <label class="form-radio">
                        <input type="radio" on:click={() => update(`${item}:read`, `any`)} bind:group={selected[`${item}:read`]} name={`${item}:read`} value="any" disabled={!role}>
                        <i class="form-icon"></i> Any
                    </label>
                </td>
                <td>
                    <label class="form-radio">
                        <input class="radio" type="radio" on:click={() => update(`${item}:update`, `none`)} name={`${item}:update`} value="none" disabled={!role}>
                        <i class="form-icon"></i> None
                    </label>
                    <label class="form-radio">
                        <input type="radio" on:click={() => update(`${item}:update`, `own`)} bind:group={selected[`${item}:update`]} name={`${item}:update`} value="own" disabled={!role}>
                        <i class="form-icon"></i> Own
                    </label>
                    <label class="form-radio">
                        <input type="radio" on:click={() => update(`${item}:update`, `any`)} bind:group={selected[`${item}:update`]} name={`${item}:update`} value="any" disabled={!role}>
                        <i class="form-icon"></i> Any
                    </label>
                </td>
                <td>
                    <label class="form-radio">
                        <input class="radio" type="radio" on:click={() => update(`${item}:delete`, `none`)} name={`${item}:delete`} value="none" disabled={!role}>
                        <i class="form-icon"></i> None
                    </label>
                    <label class="form-radio">
                        <input type="radio" on:click={() => update(`${item}:delete`, `own`)} bind:group={selected[`${item}:delete`]} name={`${item}:delete`} value="own" disabled={!role}>
                        <i class="form-icon"></i> Own
                    </label>
                    <label class="form-radio">
                        <input type="radio" on:click={() => update(`${item}:delete`, `any`)} bind:group={selected[`${item}:delete`]} name={`${item}:delete`} value="any" disabled={!role}>
                        <i class="form-icon"></i> Any
                    </label>
                </td>
            </tr>
        {/each}
    </tbody>
</table>

<dialog bind:this={confirm}>
    <article class="col-6">
        <div class="columns">
            <div class="col-4"><i class="ic-xl p-centered text-error" data-feather="alert-octagon"></i></div>
            <div class="col-8">
                <h3 class="mb-1">Delete ?</h3>
                <div class="text-small mb-2">This is an irreversible action and cannot be undone.</div>
            </div>
        </div>
        <span class="d-inline-block flex-centered " style="margin-top: 2em">
            <button class="btn btn-primary mx-1" on:click={() => {}}>Delete</button>
            <button class="btn mx-1" on:click={hide}>Cancel</button>
        </span>
    </article>
</dialog>

<style>
    .radio {}
</style>
