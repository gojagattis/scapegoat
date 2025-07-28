<script>
    import { onMount } from 'svelte';
    import {browser} from "$app/environment";
    import { token, query, capitalize, emailRegex, passwordRegex } from '$lib/common.js';
    import dayjs from "dayjs";
    import { goto } from '$app/navigation';
    import { permissions } from '$lib/common.svelte.js';
    import { page } from '$app/state';

    let { children } = $props()
    let authenticated = $state(false)
    let model = $state({username: '', password: '', extend: false})
    let error = $state('');
    let success = $state('');
    let resources = $state([])
    let theme = $state('☪')
    let enroll = $state(false)
    let confirm = $state('')

    $effect(() => {
        if (enroll || !enroll) {
            error = confirm = ''
            model = {username: '', password: '', extend: false}
        }
        if (enroll) {
            success = ''
        }
    })

    function privileges(roles, dependents) {
        resources = []
        roles.forEach(role => {
            role.permissions.forEach(perm => {
                if (!dependents.includes(perm.resource) && (perm.action === 'read:own' ||
                  perm.resource === 'privileges' || (perm.action === 'read:any' &&
                  role.permissions.filter(p => p.resource === perm.resource).length > 1))) {
                    resources.push(perm.resource)
                }
                permissions.push(perm)
            })
        })
    }

    onMount(async () => {
        const params = page.url.searchParams
        const key = params.get('key')
        if (key) {
            const response = await fetch(`/signup?key=${key}`, {})
            const data = await response.json()
            if (response.ok) {
                success = data.message
            } else {
                error = data.message
            }
        }
        const jwt = token();
        if (jwt) {
            const now = dayjs().unix();
            const claims = (JSON.parse(atob(jwt.split('.')[1])));
            if (claims.exp > now) {
                authenticated = true
                privileges((await query(`/users/${claims.sub}?select=roles!@(permissions@resource@action)`)).json.roles,
                  localStorage.getItem('dependents'))
            } // TODO else
        } else {
            document.forms[0].elements[0].focus()
        }
    })

    async function signup() {
        error = ''
        if (!model.username || !new RegExp(emailRegex).test(model.username)) {
            error += 'Invalid email\n'
        }
        if (!model.password || !new RegExp(passwordRegex).test(model.password)) {
            error += 'Invalid password\n'
        }
        if (model.password !== confirm) {
            error += 'Passwords do not match\n'
        }
        if (!error) {
            const response = await fetch('/signup', {
                method: 'POST',
                body: JSON.stringify(model),
                headers: {
                    'Content-type': 'application/json'
                }
            });
            const data = await response.json();
            if (response.status === 200) {
                await login()
            } else if (response.status === 202) {
                enroll = false
                success = data.message
            } else {
                error = data.message
            }
        }
    }

    async function login() {
        const response = await fetch('/login', {
            method: 'POST',
            body: JSON.stringify(model),
            headers: {
                'Content-type': 'application/json'
            }
        });
        const data = await response.json();
        if (response.ok) {
            if (model.extend) {
                localStorage.setItem('token', JSON.stringify(data.token))
            } else {
                sessionStorage.setItem('token', JSON.stringify(data.token))
            }
            document.cookie = "token=" + data.token + "; path=/";
            authenticated = true
            privileges(data.roles, data.dependents)
            localStorage.setItem('dependents', JSON.stringify(data.dependents))
        } else {
            error = data.message
        }
    }

    function logout() {
        permissions.length = 0
        sessionStorage.clear()
        localStorage.clear()
        document.cookie = "token=; max-age=0; path=/"
        authenticated = enroll = false
        resources = []
        model = {username: '', password: '', extend: false}
        error = confirm = success = ''
        goto('/')
    }

    function toggle(){
        if (theme === '☪'){
            theme = '☀'
            document.documentElement.setAttribute('data-theme', 'dark')
        } else {
            theme = '☪'
            document.documentElement.setAttribute('data-theme', 'light')
        }
    }

</script>

<svelte:head>
    <title>Scapegoat</title>
    <link rel="stylesheet" href="/classless.css">
    <link rel="stylesheet" href="/siimple-icons.css">
    <link rel="stylesheet" href="/tabbox.css">
    <link rel="stylesheet" href="/themes.css">
</svelte:head>

{#if browser}
    {#if authenticated}
        <nav>
            <ul>
                <li><a href="/">Home</a></li>
                {#each resources as resource}
                    <li><a href={resource}>{capitalize(resource)} </a></li>
                {/each}
                <li><a href="#/">Menu ▾</a>
                    <ul>
                        <li><a href="#/" onclick={toggle}>{theme}</a></li>
                        <li><a href="#/" onclick={logout}>Logout</a></li>
                    </ul>
                </li>
            </ul>
        </nav>
        {@render children()}
    {:else}
        <fieldset>
            {#if enroll}
                <hgroup>
                    <h1>Sign up</h1>
                    <h2>Create a new account</h2>
                </hgroup>
                <span style="color: red">{error}</span>
                <form>
                    <label>Email<input type="text" bind:value={model.username}></label>
                    <label>Password<input type="password" bind:value={model.password}></label>
                    <label>Confirm Password<input type="password" bind:value={confirm}></label>
                    <button onclick={signup}>Sign up</button>
                </form>
                <a href="#/" onclick={() => enroll = false}>Sign in</a> |
                <a href="/forgot">Forgot password?</a>
            {:else}
                <hgroup>
                    <h1>Sign in</h1>
                    <h2>Login to your account</h2>
                </hgroup>
                <span style="color: red">{error}</span>
                <span style="color: darkgreen">{success}</span>
                <form>
                    <label>Email<input type="text" bind:value={model.username}></label>
                    <label>Password<input type="password" bind:value={model.password}></label>
                    <label><input type="checkbox" bind:checked={model.extend}> Remember me</label>
                    <button onclick={login}>Login</button>
                </form>
                <a href="#/" onclick={() => enroll = true}>Sign up</a> |
                <a href="/forgot">Forgot password?</a>
            {/if}
        </fieldset>
    {/if}
{:else}
    Loading...
{/if}

<style>
    a:link {
        text-decoration: none;
    }
    a:visited {
        text-decoration: none;
    }
    a:hover {
        text-decoration: none;
    }
    a:active {
        text-decoration: none;
    }
</style>
