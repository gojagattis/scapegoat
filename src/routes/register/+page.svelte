<script>
    import {browser} from "$app/environment";
    import {emailRegex, passwordRegex, query} from "$lib/common.js";
    import {onMount} from "svelte";

    let width = browser ? window.innerWidth : 1001
    let cols
    $: if (width > 1000) {
        cols = 'col-4 col-mx-auto'
    } else if (width > 500 && width < 1000) {
        cols = 'col-7 col-mx-auto'
    } else {
        cols = 'col-10 col-mx-auto'
    }
    let model = {username: '', password: ''}
    let msg = ''
    let confirm = ''

    onMount(async () => {
        if (window.location.search) {
            document.getElementById('register').style.display = 'none'
            const data = await query(`${window.location.pathname}${window.location.search}`)
            msg = data.message
        }
    })

    async function login() {
        let valid = true
        msg = ''
        if (!model.username || !new RegExp(emailRegex).test(model.username)) {
            msg += 'Invalid email\n'
            valid = false
        }
        if (!model.password || !new RegExp(passwordRegex).test(model.password)) {
            msg += 'Invalid password\n'
            valid = false
        }
        if (model.password !== confirm) {
            msg += 'Passwords do not match\n'
            valid = false
        }
        if (valid) {
            let response = await fetch('/register', {
                method: 'POST',
                body: JSON.stringify(model),
                headers: {
                    'Content-type': 'application/json'
                }
            });
            let data = await response.json();
            if (response.ok) {
                model = {}
                confirm = ''
                document.getElementById('register').style.display = 'none'
                msg = data.message
                // window.location.href = '/login'
            } else {
                msg = data.message
            }
        }
    }

</script>

<svelte:window on:resize={() => {width = window.innerWidth}}></svelte:window>

<div class={cols} style="margin-top: 2em; border: 1px solid lightgray; padding: 3em">
    <hgroup>
        <h1 class="flex-centered">Sign up</h1>
        <h2 class="flex-centered">Create your account</h2>
    </hgroup>
    <span class="text-error flex-centered mb-1" style="white-space: pre">{msg}</span>
    <form id="register" class="form-group mb-0" on:submit|preventDefault>
        <label>Email<input class="form-input mb-1" type="text" bind:value={model.username} autofocus></label>
        <label>Password (min 8 chars)<input class="form-input mb-1" type="password" bind:value={model.password}></label>
        <label>Retype Password<input class="form-input mb-1" type="password" bind:value={confirm}></label>
        <button type="submit" class="btn btn-primary col-4 p-centered my-2" on:click={login}>Create</button>
    </form>
    <hr class="my-2">
    <nav>
        <ul>
            <li style="padding: 0 var(--nav-element-spacing-horizontal);"><a href="/login" style="text-decoration: none">Login</a></li>
        </ul>
        <ul>
            <li style="padding: 0 var(--nav-element-spacing-horizontal);"><a href="/forgot" style="text-decoration: none">Forgot password?</a></li>
        </ul>
    </nav>
</div>
