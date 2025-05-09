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
                value.creator = (claims(event)).sub
            }
            prepare(value, event)
        }
    })
}

export const token = (event) => {
    let jwt = (event.request.headers.get('authorization'))?.replace('Bearer ', '')
    if (!jwt) {
        jwt = event.cookies.get('token')
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
    if (params.select) {
        query = include('select', params.select);
    } else if (params.include) {
        query = include('include', params.include);
    }
    return query
}

function convert(schema, col, data) {
    const meta = schema.find(s => s.name === col)
    if (meta) {
        switch (meta.type) {
            case 'Int':
            case 'Float':
                return Number(data)
            case 'DateTime':
                return new Date(data)
            case 'Boolean':
                return data === 'true'
        }
    }
    return data
}

function compose(param, ops, op, schema) {
    const term = param.split(',')
    if (term.length === 5) {
        const meta = schema.find(s => s.name === term[0])
        ops[op].push(
          {
              [term[0]]: {
                  [term[1]]: {
                      [term[2]]: {
                          [term[3]]: convert(cache.get(meta.type), term[2], term[4])
                      }
                  }
              }
          }
        )
    } else if (term.length === 3) {
        ops[op].push(
          {
              [term[0]]: {
                  [term[1]]: convert(schema, term[0], term[2])
              }
          }
        )
    }
}

export const where = (param, schema) => {
    const ops = {
        OR: [],
        AND:[],
        NOT: []
    }
    if (param.startsWith('@(')) {
        const unit = param.split('@(')
        unit.shift()
        unit.forEach(u => {
            const terms = u.split('@')
            const op = terms[0]
            terms.shift()
            terms.forEach(t => {
                t = t.endsWith(')') ? t.slice(0, -1) : t
                compose(t, ops, op, schema)
            })
        })
    } else {
        compose(param, ops, 'AND', schema)
    }
    return ops
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
