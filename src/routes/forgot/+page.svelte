<script>
    import {browser} from "$app/environment";
    import {emailRegex} from "$lib/common.js";

    let width = browser ? window.innerWidth : 1001
    let cols
    $: if (width > 1000) {
        cols = 'col-4 col-mx-auto'
    } else if (width > 500 && width < 1000) {
        cols = 'col-7 col-mx-auto'
    } else {
        cols = 'col-10 col-mx-auto'
    }
    let model = {username: ''}
    let msg = ''
    let confirm = ''

    async function forgot() {
        let valid = true
        msg = ''
        if (!model.username || !new RegExp(emailRegex).test(model.username)) {
            msg += 'Invalid email\n'
            valid = false
        }
        if (valid) {
            let response = await fetch('/forgot', {
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
                document.getElementById('forgot').style.display = 'none'
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
        <h1 class="flex-centered">Forgot password?</h1>
        <h2 class="flex-centered">Reset your password</h2>
    </hgroup>
    <span class="text-error flex-centered mb-1" style="white-space: pre">{msg}</span>
    <form id="forgot" class="form-group mb-0" on:submit|preventDefault>
        <label>Email<input class="form-input mb-1" type="text" bind:value={model.username} autofocus></label>
        <button type="submit" class="btn btn-primary col-4 p-centered my-2" on:click={forgot}>Reset</button>
    </form>
    <hr class="my-2">
    <nav>
        <ul>
            <li style="padding: 0 var(--nav-element-spacing-horizontal);"><a href="/login" style="text-decoration: none">Login</a></li>
        </ul>
        <ul>
            <li style="padding: 0 var(--nav-element-spacing-horizontal);"><a href="/register" style="text-decoration: none">Register</a></li>
        </ul>
    </nav>
</div>
