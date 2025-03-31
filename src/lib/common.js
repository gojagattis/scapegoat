import Notify from "./simple-notify.es.js";
import nouns from "pluralize";

export const emailRegex = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
export const passwordRegex = /^.{8,}$/
// export const passwordRegex = /^(?=.*[0-9])(?=.*[A-Z])(?=.*[!@#$%^&*])[a-zA-Z0-9!@#$%^&*]{8,20}$/

export const labelize = (raw) => {
    return (raw.charAt(0).toUpperCase() + raw.slice(1)).replace(/([a-z])([A-Z])/g, '$1 $2')
}

export const singularize = (raw) => {
    const label = labelize(raw)
    const last = label.split(' ').pop()
    return label.replace(last, nouns.singular(last))
}

export const token = () => {
    let value = sessionStorage.getItem('auth')
    if (!value) {
        value = localStorage.getItem('auth')
    }
    if (!value) {
        value = document.cookie.split('=')[1]
    }
    return value ? value.replaceAll('"', '') : null
}

export const bearer = `Bearer ${token()}`

export const query = async (endpoint) => {
    const response = await fetch(endpoint, {
        headers: {
            'Authorization': bearer
        }
    });
    const data = await response.json();
    if (response.ok) {
        return data
    }
}
