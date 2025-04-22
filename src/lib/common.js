import nouns from "pluralize";
import { browser } from '$app/environment';

export const take = 25
export const emailRegex = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
export const passwordRegex = /^.{8,}$/
// export const passwordRegex = /^(?=.*[0-9])(?=.*[A-Z])(?=.*[!@#$%^&*])[a-zA-Z0-9!@#$%^&*]{8,20}$/

export const capitalize = (raw) => {
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

export const bearer = `Bearer ${token()}`

export const query = async (endpoint) => {
    const response = await fetch(endpoint, {
        headers: {
            'Authorization': bearer
        }
    });
    return await response.json();
}

export const mutate = async (endpoint, method, data) => {
    const response = await fetch(endpoint, {
        method: method,
        body: JSON.stringify(data),
        headers: {
            'Authorization': bearer,
            'Content-type': 'application/json'
        }
    });
    return await response.json();
}
