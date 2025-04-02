import jwt from "jsonwebtoken";
import {prisma} from "$lib/prisma.js";
import {AccessControl} from "accesscontrol";
import {log} from "$lib/logger.js";
import {claims, token, cache} from "$lib/server/common.js";
import {error} from "@sveltejs/kit";

const open = ['/login', '/register', '/forgot', '/reset', '/']

export async function init() {
    prisma.$queryRaw`PRAGMA journal_mode = WAL;`
    prisma.$queryRaw`PRAGMA busy_timeout = 5000;`
    prisma.$queryRaw`PRAGMA synchronous = NORMAL;`
    prisma.$queryRaw`PRAGMA wal_autocheckpoint = 0;`
    prisma.$queryRaw`pragma temp_store = memory;`
    prisma.$queryRaw`pragma mmap_size = 30000000000;`

    const models = prisma['_runtimeDataModel']['models']
    Object.keys(models).forEach(m => cache.set(m, models[m]['fields']))
}

export async function handle({ event, resolve }) {
    const before = Date.now()
    if (!(event.request.method === 'GET' && event.url.pathname === '/')) {
        log.debug(event.request.method + ' ' + event.url.pathname + event.url.search);
    }

    if (!open.includes(event.url.pathname)) {
        const auth = token(event)
        if (!auth) {
            error(401, 'An authorization header with a valid token is required to access this resource')
        } else {
            try {
                jwt.verify(auth, import.meta.env.VITE_JWT_SECRET);
            } catch (e) {
                error(401, e)
            }
        }

        const payload = claims(event);
        const resource = event.url.pathname.split('/')[1];
        const action = event.request.method;

        const roles = payload.roles;
        const grants = [];
        await prisma.permissions.findMany({
            where: {
                role: { in: roles },
            },
        }).then(p => grants.push(p))

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
            error(400, 'Bad request')
        }

        if (any.granted) {
            event.locals.possession = 'any'
        } else if (own.granted) {
            event.locals.possession = 'own'
        } else {
            error(403, `${payload.name} is denied ${action} right on ${resource}`)
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
