import nouns from "pluralize";
import { browser } from '$app/environment';

export const limit = 25
export const emailRegex = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
export const passwordRegex = /^.{8,}$/
// export const passwordRegex = /^(?=.*[0-9])(?=.*[A-Z])(?=.*[!@#$%^&*])[a-zA-Z0-9!@#$%^&*]{8,20}$/

export const capitalize = (raw) => {
    if (raw.startsWith('/')) {
        raw = raw.slice(1)
    }
    return (raw.charAt(0).toUpperCase() + raw.slice(1)).replace(/([a-z])([A-Z])/g, '$1 $2')
}

export const singularize = (raw) => {
    const label = capitalize(raw)
    const last = label.split(' ').pop()
    return label.replace(last, nouns.singular(last))
}

export const token = () => {
    if (browser) {
        let value = sessionStorage.getItem('token')
        if (!value) {
            value = localStorage.getItem('token')
        }
        if (!value) {
            value = document.cookie.split('=')[1]
        }
        return value ? value.replaceAll('"', '') : null
    }
    return null
}


export const query = async (endpoint, method = 'GET') => {
    const response = await fetch(endpoint, {
        method: method,
        headers: {
            'Authorization': `Bearer ${token()}`
        }
    })
    return {
        ok: response.ok,
        json: await response.json()
    }
}

export const mutate = async (endpoint, data, method = 'POST') => {
    const response = await fetch(endpoint, {
        method: method,
        body: JSON.stringify(data),
        headers: {
            'Authorization': `Bearer ${token()}`,
            'Content-type': 'application/json'
        }
    })
    return {
        ok: response.ok,
        json: await response.json()
    }
}
