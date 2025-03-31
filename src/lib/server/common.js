import nodemailer from "nodemailer";
import NodeCache from "node-cache";

export const cache = new NodeCache()

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
                const owner = claims(event)
                value.creator = owner.user
            }
            check(value, event)
        }
    })
}

export const token = (event) => {
    let jwt = (event.request.headers.get('authorization'))?.replace('Bearer ', '')
    if (!jwt) {
        jwt = event.cookies.get('auth')
    }
    return jwt
}

export const claims = (event) => {
    return JSON.parse(atob(token(event).split('.')[1]))
}

export const mailer = nodemailer.createTransport({
    pool: true,
    host: import.meta.env.VITE_SMTP_HOST,
    port: import.meta.env.VITE_SMTP_PORT,
    auth: {
        user: import.meta.env.VITE_SMTP_USER,
        pass: import.meta.env.VITE_SMTP_PASS,
    },
})
