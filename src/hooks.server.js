import jwt from "jsonwebtoken";
import {prisma} from "$lib/prisma.js";
import {AccessControl} from "accesscontrol";
import {log} from "$lib/logger.js";
import {tenant, header, cache} from "$lib/server/common.js";
import {error} from "@sveltejs/kit";

const open = ['/login', '/register', '/forgot', '/reset', '/', '/favicon.ico'] //open endpoints

prisma.$queryRaw`PRAGMA journal_mode = WAL;`
prisma.$queryRaw`PRAGMA busy_timeout = 5000;`
prisma.$queryRaw`PRAGMA synchronous = NORMAL;`
prisma.$queryRaw`PRAGMA wal_autocheckpoint = 0;`
prisma.$queryRaw`pragma temp_store = memory;`
prisma.$queryRaw`pragma mmap_size = 30000000000;`

const models = prisma['_runtimeDataModel']['models']
Object.keys(models).forEach(m => cache.set(m, models[m]['fields']))

//check valid jwt, permission to call endpoint, add posession to request
export async function handle({ event, resolve }) {
    const before = Date.now()
    if (!(event.request.method === 'GET' && event.url.pathname === '/')) {
        log.debug(event.request.method + ' ' + event.url.pathname + event.url.search);
    }

    if (!open.includes(event.url.pathname)) {
        const token = header(event)
        if (!token) {
            throw error(401, 'An authorization header with a valid token is required to access this resource')
        } else {
            try {
                jwt.verify(token, import.meta.env.VITE_JWT_SECRET);
            } catch (e) {
                throw error(401, e)
            }
        }

        const payload = tenant(event);
        const resource = event.url.pathname.split('/')[1];
        const action = event.request.method;

        const roles = [];
        const grants = [];
        await prisma.users.findUnique({
            where: {
                id: payload.user
            },
            include: {
                roles: {
                    include: {
                        permissions: true
                    }
                }
            }
        }).then(user => user.roles.forEach(r => {
            roles.push(r.name)
            r.permissions.forEach(p => grants.push(p))
        }))

        const ac = new AccessControl(grants);
        let any, own;
        if (action === 'GET') {
            for (let i = 0; i < roles.length; i++) {
                any = ac.can(roles[i]).readAny(resource)
                if (any.granted) {
                    break
                }
                if (!own || !own.granted) {
                    own = ac.can(roles[i]).readOwn(resource)
                }
            }
        } else if (action === 'POST') {
            for (let i = 0; i < roles.length; i++) {
                any = ac.can(roles[i]).createAny(resource)
                if (any.granted) {
                    break
                }
                if (!own || !own.granted) {
                    own = ac.can(roles[i]).createOwn(resource)
                }
            }
        } else if (action === 'PUT') {
            for (let i = 0; i < roles.length; i++) {
                any = ac.can(roles[i]).updateAny(resource)
                if (any.granted) {
                    break
                }
                if (!own || !own.granted) {
                    own = ac.can(roles[i]).updateOwn(resource)
                }
            }
        } else if (action === 'DELETE') {
            for (let i = 0; i < roles.length; i++) {
                any = ac.can(roles[i]).deleteAny(resource)
                if (any.granted) {
                    break
                }
                if (!own || !own.granted) {
                    own = ac.can(roles[i]).deleteOwn(resource)
                }
            }
        } else {
            throw error(400, 'Unsupported')
        }

        if (any.granted) {
            event.possession = {any: true}
        } else if (own.granted) {
            event.possession = {own: true}
        } else {
            throw error(403, `${payload.name} is denied ${action} right on ${resource}`)
        }
    }

    const response = await resolve(event);
    const after = Date.now()
    log.debug(`${event.request.method} ${event.url.pathname}  ${after - before}ms`);
    return response
}

export async function handleError({ error, event, status, message }) {
    const errorId = crypto.randomUUID();
    error.ref = errorId;
    log.error('%O', error);

    return {
        message: error.message,
        ref: errorId,
    };
}
