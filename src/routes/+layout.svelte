<script>
    import {goto} from "$app/navigation";
    import {onMount, setContext} from "svelte";
    import {browser} from "$app/environment";
    import {query, token} from "$lib/common.js";
    import dayjs from "dayjs";
    import {writable} from "svelte/store";

    let authenticated = false
    const auth_obj = writable(authenticated)
    setContext('authenticated', auth_obj)
    $: auth_obj.set(authenticated)
    let config = {}
    const conf_obj = writable(config)
    setContext('config', conf_obj)
    $: conf_obj.set(config)
    let warn, interval, display, terminate
    let remaining = 0
    $: countdown = `${Math.floor(remaining / 60)}:${(remaining % 60).toLocaleString('en-US', {
        minimumIntegerDigits: 2,
        useGrouping: false
    })}`
    let width = browser ? window.innerWidth : undefined
    let height = browser ? window.innerHeight : undefined
    let sidebar, left, right
    $: sidebar = width > 1000;
    $: if (sidebar) {
        if (width > 1000) {
            left = 'column col-2'
            right = 'column col-10'
        } else if (width > 500 && width < 1000) {
            left = 'column col-4'
            right = 'column col-8'
        } else {
            left = 'column col-6'
            right = 'column col-6'
        }
    }
    $: if (!sidebar) {
        right = 'column col-12'
    }
    let org, usr, adm

    function hide() {
        document.documentElement.classList.remove('modal-is-open');
        warn.removeAttribute('open');
    }

    async function extend() {
        const data = await query(`/login`)
        if (data) {
            if (sessionStorage.getItem('auth')) {
                sessionStorage.setItem('auth', JSON.stringify(data))
            } else {
                localStorage.setItem('auth', JSON.stringify(data))
            }
            document.cookie = "auth=" + data + "; path=/";
            hide()
            const now = dayjs().unix()
            const payload = (JSON.parse(atob(data.split('.')[1])));
            show(payload.exp, now)
            invalidate(payload.exp, now)
        }
    }

    async function swap() {
        const data = await query(`/login/${org}`)
        if (data) {
            if (sessionStorage.getItem('auth')) {
                sessionStorage.setItem('auth', JSON.stringify(data))
            } else {
                localStorage.setItem('auth', JSON.stringify(data))
            }
            document.cookie = "auth=" + data + "; path=/";
            goto('/')
        }
    }

    onMount(async () => {
        document.documentElement.setAttribute('data-theme', 'light')
        const jwt = token()
        if (jwt) {
            const now = dayjs().unix()
            const payload = (JSON.parse(atob(jwt.split('.')[1])));
            if (payload.exp > now) {
                authenticated = true
                org = payload.org
                usr = payload.user
                adm = payload.admin
                sidebar = adm
                show(payload.exp, now)
                invalidate(payload.exp, now)
                config = await query('/config')
            }
        }
        if (!authenticated && window.location.pathname !== '/register'
            && window.location.pathname !== '/reset') {
            goto('/login')
        }
    })

    function show(exp, now) {
        window.clearTimeout(display)
        window.clearInterval(interval)
        display = setTimeout(() => {
            const jwt = token()
            if (jwt) {
                const ts = dayjs().unix()
                const payload = (JSON.parse(atob(jwt.split('.')[1])));
                if (payload.exp - ts <= 120) {
                    remaining = payload.exp - ts
                    interval = setInterval(() => {
                        --remaining
                    }, 1000)
                    document.documentElement.classList.add('modal-is-open');
                    warn.setAttribute('open', '');
                } else {
                    show(payload.exp, ts)
                }
            }
        }, (exp - now - 120) * 1000)
    }

    function invalidate(exp, now) {
        window.clearTimeout(terminate)
        terminate = setTimeout(() => {
            const jwt = token()
            if (jwt) {
                const ts = dayjs().unix()
                const payload = (JSON.parse(atob(jwt.split('.')[1])));
                if (payload.exp - ts <= 0) {
                    logout()
                } else {
                    invalidate(payload.exp, ts)
                }
            }
        }, (exp - now) * 1000)
    }

    function logout() {
        sessionStorage.clear()
        localStorage.clear()
        document.cookie = "auth=; max-age=0; path=/";
        window.location.href = '/login';
    }
</script>

<svelte:window on:resize={() => {width = window.innerWidth; height = window.innerHeight}}></svelte:window>

<svelte:head>
    <title>Fiksie</title>
    <link rel="stylesheet" href="/classless.css">
</svelte:head>

{#if browser && authenticated}
    <nav class="mx-2">
        <ul>
            {#if adm}
                <li on:click={() => sidebar = !sidebar}>Menu</li>
            {/if}
        </ul>
        <ul>
            <!--            <li><a href="#">Link</a></li>-->
            <li role="list" dir="rtl">
                <a href="#" aria-haspopup="listbox"><figure class="avatar c-hand" data-initial={usr[0]}></figure></a>
                <ul role="listbox">
                    <li>{usr}</li>
                    <li><a href="/reset">Reset password</a></li>
                    <li><a href="" on:click|preventDefault={logout}>Logout</a></li>
                </ul>
            </li>
        </ul>
    </nav>
    <div class="columns mx-2">
        {#if adm}
            <div class={left} class:d-hide={!sidebar} style="overflow: auto; height: {height}px">
                {#await query('/organizations')}
                {:then data}
                    <select bind:value={org} class="form-select mb-2" on:change={swap}>
                        {#each data as item}
                            <option value={item.id}>{item.name}</option>
                        {/each}
                    </select>
                {/await}
                <a href="/">Home</a><hr>
                <details>
                    <summary>Admin</summary>
                    <ul>
                        <li><a href="/organizations">Organizations</a></li>
                        <li><a href="/users">Users</a></li>
                        <li><a href="/roles">Roles</a></li>
                        <li><a href="/privileges">Permissions</a></li>
                    </ul>
                </details>
                <a href="#">Link</a><br>
            </div>
            <div class={right} style="overflow: auto"><slot></slot></div>
        {:else}
            <div class="column col-8 col-mx-auto"><slot></slot></div>
        {/if}
    </div>
{:else}
    <slot></slot>
{/if}

<dialog bind:this={warn}>
    <article class="col-6">
        <div class="columns">
            <div class="col-8">
                <h3 class="mb-1">Session Timeout Warning</h3>
                <div class="text-small mb-2">Your session will timout in {countdown} minutes.</div>
            </div>
        </div>
        <span class="d-inline-block flex-centered " style="margin-top: 2em">
            <button class="btn btn-primary mx-1" on:click={extend}>Continue working</button>
            <!--            <button class="btn mx-1" on:click={() => {}}>Cancel</button>-->
        </span>
    </article>
</dialog>

<style>
    li {
        list-style: none;
    }
    a {
        text-decoration: none;
    }
</style>
