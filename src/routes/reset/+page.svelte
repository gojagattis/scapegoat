<script>
    import {browser} from "$app/environment";
    import {passwordRegex, token} from "$lib/common.js";
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
    let model = {previous: '', password: '', nonce: ''}
    let msg = ''
    let confirm = ''
    let nonce = ''
    let jwt = ''
    let hide = true
    $: style = !jwt ? 'margin-top: 2em; border: 1px solid lightgray; padding: 3em' : ''

    onMount(async () => {
        nonce = (new URLSearchParams(window.location.search)).get('nonce')
        jwt = token()
        if (!nonce && !jwt) {
            document.getElementById('reset').style.display = 'none'
            msg = `Invalid request`
        }
        hide = false
    })

    async function reset() {
        let valid = true
        msg = ''
        if (!model.password || !new RegExp(passwordRegex).test(model.password)) {
            msg += 'Invalid new password\n'
            valid = false
        }
        if (model.password !== confirm) {
            msg += 'New passwords do not match\n'
            valid = false
        }
        if (valid) {
            model.nonce = nonce
            let response = await fetch('/reset', {
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
                document.getElementById('reset').style.display = 'none'
                msg = data.message
            } else {
                msg = data.message
            }
        }
    }

</script>

<svelte:window on:resize={() => {width = window.innerWidth}}></svelte:window>

<div class={cols} class:d-invisible={hide} style={style}>
    <hgroup>
        <h1 class="flex-centered">Reset password</h1>
        <h2 class="flex-centered">Reset your password</h2>
    </hgroup>
    <span class="text-error flex-centered mb-1" style="white-space: pre">{msg}</span>
    <form id="reset" class="form-group mb-0" on:submit|preventDefault>
        <label class:d-hide={nonce}>Previous Password<input class="form-input mb-1" type="password" bind:value={model.previous} autofocus></label>
        <label>New Password (min 8 chars)<input class="form-input mb-1" type="password" bind:value={model.password}></label>
        <label>Retype New Password<input class="form-input mb-1" type="password" bind:value={confirm}></label>
        <button type="submit" class="btn btn-primary col-4 p-centered my-2" on:click={reset}>Reset</button>
    </form>
    <hr class="my-2" class:d-invisible={jwt}>
    <nav class:d-invisible={jwt}>
        <ul>
            <li style="padding: 0 var(--nav-element-spacing-horizontal);"><a href="/login" style="text-decoration: none">Login</a></li>
        </ul>
        <ul>
            <li style="padding: 0 var(--nav-element-spacing-horizontal);"><a href="/forgot" style="text-decoration: none">Forgot password?</a></li>
        </ul>
    </nav>
</div>
