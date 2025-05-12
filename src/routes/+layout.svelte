<script>
    import {onMount} from "svelte";
    import {browser} from "$app/environment";
    import { token, query, capitalize } from "$lib/common.js";
    import dayjs from "dayjs";
    import { goto } from '$app/navigation';

    let { children } = $props()
    let authenticated = $state(false)
    let model = $state({username: '', password: '', extend: false})
    let error = $state('');
    let resources = $state([])

    function privileges(roles) {
        resources = []
        roles.forEach(role => {
            role.permissions.forEach(perm => {
                if (perm.action.startsWith('read:')) {
                    resources.push(perm.resource)
                }
            })
        })
    }

    onMount(async () => {
        const jwt = token()
        if (jwt) {
            const now = dayjs().unix();
            const claims = (JSON.parse(atob(jwt.split('.')[1])));
            if (claims.exp > now) {
                authenticated = true
                privileges((await query(`/users/${claims.sub}?select=roles!@(permissions@resource@action)`)).json.roles)
            } // TODO else
        } else {
            document.forms[0].elements[0].focus()
        }
    })

    async function login() {
        let response = await fetch('/login', {
            method: 'POST',
            body: JSON.stringify(model),
            headers: {
                'Content-type': 'application/json'
            }
        });
        let data = await response.json();
        if (response.ok) {
            if (model.extend) {
                localStorage.setItem('token', JSON.stringify(data.token))
            } else {
                sessionStorage.setItem('token', JSON.stringify(data.token))
            }
            document.cookie = "token=" + data.token + "; path=/";
            authenticated = true
            privileges(data.roles)
        } else {
            error = data.message
        }
    }

    function logout() {
        sessionStorage.clear()
        localStorage.clear()
        document.cookie = "token=; max-age=0; path=/"
        authenticated = false
        resources = []
        model = {username: '', password: '', extend: false}
        error = ''
        goto('/')
    }
</script>

<svelte:head>
    <title>Scapegoat</title>
    <link rel="stylesheet" href="/classless.css">
    <link rel="stylesheet" href="/siimple-icons.css">
    <link rel="stylesheet" href="/tabbox.css">
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
                        <li><a href="#/" onclick={logout}>Logout</a></li>
                    </ul>
                </li>
            </ul>
        </nav>
        {@render children()}
    {:else}
        <fieldset>
            <hgroup>
                <h1>Sign in</h1>
                <h2>Login to your account</h2>
            </hgroup>
            <span style="color: red">{error}</span>
            <form>
                <label>Email<input type="text" bind:value={model.username}></label>
                <label>Password<input type="password" bind:value={model.password}></label>
                <label><input type="checkbox" bind:checked={model.extend}> Remember me</label>
                <button onclick={login}>Login</button>
            </form>
            <a href="/register">Sign up</a> |
            <a href="/forgot">Forgot password?</a>
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
