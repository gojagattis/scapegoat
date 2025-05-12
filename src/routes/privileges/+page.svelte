<script>
    import {onMount} from "svelte";
    import {token, query} from "$lib/common";
    import { page } from '$app/state';

    const resource = page.url.pathname.slice(1)
    let roles = []
    let resources = []
    let permissions = []
    let selected = {}
    let role
    let changed = false

    async function load() {
        const response = (await query(resource)).json
        roles = response.roles
        resources = response.resources
    }

    onMount(async () => {
        await load()
    })

    async function display() {
        if (changed) {
            await load()
            changed = false
        }
        Array.from(document.getElementsByClassName('radio')).forEach(e => e.checked = false)
        selected = {}
        permissions = roles.find(r => r.id === role).permissions
        if (role) {
            permissions.forEach(p => {
                selected[`${p.resource}:${p.action.split(':')[0]}`] = p.action.split(':')[1]
            })
        }
    }

    async function update(key, value) {
        changed = true
        const tokens = key.split(':')
        if (selected.hasOwnProperty(key)) {
            const perm = permissions.find(p => p.resource === tokens[0] && p.action.startsWith(tokens[1]))
            if (value === 'none') {
                const response = await fetch(`/permissions/${perm.id}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${token()}`,
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
                        'Authorization': `Bearer ${token()}`,
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
                    'Authorization': `Bearer ${token()}`,
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
    <select bind:value={role} class="form-select" on:change={display}>
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
                    <label>
                        <input class="radio" type="radio" on:click={() => update(`${item}:create`, `none`)} name={`${item}:create`} value="none" disabled={!role}> None
                    </label>
                    <label>
                        <input class="radio" type="radio" on:click={() => update(`${item}:create`, `own`)} bind:group={selected[`${item}:create`]} name={`${item}:create`} value="own" disabled={!role}> Own
                    </label>
                    <label>
                        <input class="radio" type="radio" on:click={() => update(`${item}:create`, 'any')} bind:group={selected[`${item}:create`]} name={`${item}:create`} value="any" disabled={!role}> Any
                    </label>
                </td>
                <td>
                    <label>
                        <input class="radio" type="radio" on:click={() => update(`${item}:read`, `none`)} name={`${item}:read`} value="none" disabled={!role}> None
                    </label>
                    <label>
                        <input class="radio" type="radio" on:click={() => update(`${item}:read`, `own`)} bind:group={selected[`${item}:read`]} name={`${item}:read`} value="own" disabled={!role}> Own
                    </label>
                    <label>
                        <input class="radio" type="radio" on:click={() => update(`${item}:read`, `any`)} bind:group={selected[`${item}:read`]} name={`${item}:read`} value="any" disabled={!role}> Any
                    </label>
                </td>
                <td>
                    <label>
                        <input class="radio" type="radio" on:click={() => update(`${item}:update`, `none`)} name={`${item}:update`} value="none" disabled={!role}> None
                    </label>
                    <label>
                        <input class="radio" type="radio" on:click={() => update(`${item}:update`, `own`)} bind:group={selected[`${item}:update`]} name={`${item}:update`} value="own" disabled={!role}> Own
                    </label>
                    <label>
                        <input class="radio" type="radio" on:click={() => update(`${item}:update`, `any`)} bind:group={selected[`${item}:update`]} name={`${item}:update`} value="any" disabled={!role}> Any
                    </label>
                </td>
                <td>
                    <label>
                        <input class="radio" type="radio" on:click={() => update(`${item}:delete`, `none`)} name={`${item}:delete`} value="none" disabled={!role}> None
                    </label>
                    <label>
                        <input class="radio" type="radio" on:click={() => update(`${item}:delete`, `own`)} bind:group={selected[`${item}:delete`]} name={`${item}:delete`} value="own" disabled={!role}> Own
                    </label>
                    <label>
                        <input class="radio" type="radio" on:click={() => update(`${item}:delete`, `any`)} bind:group={selected[`${item}:delete`]} name={`${item}:delete`} value="any" disabled={!role}> Any
                    </label>
                </td>
            </tr>
        {/each}
    </tbody>
</table>

<style>
    .radio {}
</style>
