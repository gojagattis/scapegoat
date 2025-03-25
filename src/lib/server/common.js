import nodemailer from "nodemailer";
import NodeCache from "node-cache";

export const cache = new NodeCache()

const char_set = '0123456789abcdefghijlkmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function max_random_number(max) {
    return Math.floor(Math.random() * max);
}

export const random = (length) => {
    let random_string = '';
    for(let i = 0; i < length; i++) {
        random_string += char_set[max_random_number(char_set.length - 1)];
    }
    return random_string;
}

export const remove = (data, keys) => {
    for (let i in data) {
        if (typeof data[i] === 'object') {
            remove(data[i], keys)
        } else if (keys.includes(i)) {
            delete data[i]
        }
    }
}

export const check = (obj, event) => {
    Object.entries(obj).forEach(entry => {
        const [key, value] = entry
        if (value && typeof value === 'object') {
            if (key === 'create') {
                const owner = tenant(event)
                value.creator = owner.user
                value.org = owner.org
            }
            check(value, event)
        }
    })
}

export const header = (event) => {
    let token = (event.request.headers.get('authorization'))?.replace('Bearer ', '')
    if (!token) {
        token = event.cookies.get('auth')
    }
    return token
}

export const tenant = (event) => {
    const payload = (JSON.parse(atob(header(event).split('.')[1])))
    return {
        user: payload.sub,
        org: payload.org,
        name: payload.user,
        admin: payload.admin,
        long: payload.long
    }
}

export const emailer = nodemailer.createTransport({
    pool: true,
    host: import.meta.env.VITE_SMTP_HOST,
    port: import.meta.env.VITE_SMTP_PORT,
    auth: {
        user: import.meta.env.VITE_SMTP_USER,
        pass: import.meta.env.VITE_SMTP_PASS,
    },
})
