<script>
    import {browser} from "$app/environment";

    let width = browser ? window.innerWidth : 1001
    let cols
    $: if (width > 1000) {
        cols = 'col-4 col-mx-auto'
    } else if (width > 500 && width < 1000) {
        cols = 'col-7 col-mx-auto'
    } else {
        cols = 'col-10 col-mx-auto'
    }
    let model = {username: '', password: '', remember: false}
    let msg = '';

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
            if (model.remember) {
                localStorage.setItem('auth', JSON.stringify(data))
            } else {
                sessionStorage.setItem('auth', JSON.stringify(data))
            }
            document.cookie = "auth=" + data + "; path=/";
            window.location.href = '/'
        } else {
            msg = data.message
        }
    }

</script>

<svelte:window on:resize={() => {width = window.innerWidth}}></svelte:window>

<div class={cols} style="margin-top: 2em; border: 1px solid lightgray; padding: 3em">
    <hgroup>
        <h1 class="flex-centered">Sign in</h1>
        <h2 class="flex-centered">Login to your account</h2>
    </hgroup>
    <span class="text-error flex-centered mb-1">{msg}</span>
    <form class="form-group mb-0" on:submit|preventDefault>
        <label>Email<input class="form-input mb-1" type="text" bind:value={model.username} autofocus></label>
        <label>Password<input class="form-input mb-1" type="password" bind:value={model.password}></label>
        <label class="form-checkbox"><input type="checkbox" bind:checked={model.remember}><i class="form-icon"></i> Remember me</label>
        <button type="submit" class="btn btn-primary col-4 p-centered my-2" on:click={login}>Login</button>
    </form>
    <hr class="my-2">
    <nav>
        <ul>
            <li style="padding: 0 var(--nav-element-spacing-horizontal);"><a href="/register" style="text-decoration: none">Register</a></li>
        </ul>
        <ul>
            <li style="padding: 0 var(--nav-element-spacing-horizontal);"><a href="/forgot" style="text-decoration: none">Forgot password?</a></li>
        </ul>
    </nav>
</div>
