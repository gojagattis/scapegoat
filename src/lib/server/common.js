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

function parse(term) {
    const section = {}
    const unit = term.split('@')
    if (unit.length === 1) {
        section[unit] = true
    } else {
        const initial = unit.shift()
        section[initial] = {
            select: {}
        }
        unit.forEach(field => {
            if (field) {
                section[initial]['select'][field] = true
            }
        })
    }
    return section
}

function destructure(term) {

    const section = {}
    const index = term.indexOf('@(')
    if (index !== -1) {
        const first = term.slice(0, index)
        const last = term.slice(index + 1)
        let [k, v] = (Object.entries(parse(first)))[0]

        const [x, y] = (Object.entries(destructure(last.slice(1, -1))))[0]
        if (typeof v === 'object') {
            section[k] = v
            v[(Object.keys(v))[0]][x] = y
        } else {
            section[k.at(-1) === '!' ? k.slice(0, -1) : k] = {
                [k.at(-1) === '!' ? 'select' : 'include']: {
                    [x]: y,
                }
            }
        }
    } else {
        const [k, v] = (Object.entries(parse(term)))[0]
        section[k] = v
    }
    return section
}

function include(op, params) {
    const query = {}
    const terms = params.split(',')

    query[op] = {}

    terms.forEach(term => {
        if (term.startsWith('@')) {
            term.split('@').forEach(field => {
                if (field) {
                    query[op][field] = true
                }
            })
        } else {
            const [k, v] = (Object.entries(destructure(term)))[0]
            query[op][k] = v
        }
    })

    return query
}

export const graph = (params) => {
    let query
    if (params.get('select')) {
        query = include('select', params.get('select'));
    } else if (params.get('include')) {
        query = include('include', params.get('include'));
    }
    return query
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
