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
