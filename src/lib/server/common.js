import nodemailer from "nodemailer";
import NodeCache from "node-cache";

export const cache = new NodeCache()

export const sanitize = (data, keys) => {
    for (let i in data) {
        if (typeof data[i] === 'object') {
            sanitize(data[i], keys)
        } else if (keys.includes(i)) {
            delete data[i]
        }
    }
}

export const prepare = (obj, event) => {
    Object.entries(obj).forEach(entry => {
        const [key, value] = entry
        if (value && typeof value === 'object') {
            if (key === 'create') {
                value.owner = (claims(event)).sub
            }
            prepare(value, event)
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
