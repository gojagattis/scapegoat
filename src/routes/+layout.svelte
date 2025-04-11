<script>
    import {onMount} from "svelte";
    import {browser} from "$app/environment";
    import {token} from "$lib/common.js";
    import dayjs from "dayjs";

    let { children } = $props()
    let authenticated = $state(false)
    let model = $state({username: '', password: '', extend: false})
    let error = $state('');

    onMount(async () => {
        const jwt = token()
        if (jwt) {
            const now = dayjs().unix()
            const payload = (JSON.parse(atob(jwt.split('.')[1])));
            if (payload.exp > now) {
                authenticated = true
            }
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
                localStorage.setItem('token', JSON.stringify(data))
            } else {
                sessionStorage.setItem('token', JSON.stringify(data))
            }
            document.cookie = "token=" + data + "; path=/";
            authenticated = true
            model = {username: '', password: '', extend: false}
            error = ''
        } else {
            error = data.message
        }
    }

    function logout() {
        sessionStorage.clear()
        localStorage.clear()
        document.cookie = "token=; max-age=0; path=/";
        authenticated = false
    }
</script>

<svelte:head>
    <title>Scapegoat</title>
    <link rel="stylesheet" href="/classless.css">
</svelte:head>

{#if browser}
    {#if authenticated}
        <nav>
            <ul>
                <li>Brand</li>
                <li>Sticky Right</li>
                <li><a href="#/">Item </a></li>
                <li><a href="#/">Menu ▾</a>
                    <ul>
                        <li><a href="#/">Menu 1</a></li>
                        <li><a href="#/">Menu 2</a></li>
                    </ul>
                </li>
                <li><a href="#/" onclick={logout}>Logout</a></li>
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
