import {error, json} from "@sveltejs/kit";
import {prisma} from "$lib/prisma";
import {log} from "$lib/logger.js";
import {cache, claims, sanitize, prepare} from "$lib/server/common.js";

async function fetch(id, event, skip = false, relation = null) {
    const include = {}
    if (relation) { //licensees:userRef@username
        relation.split(',').forEach(r => {
            if (r.includes(':')) {
                const graph = r.split(':')
                if (graph[1].includes('@')) {
                    const field = graph[1].split('@')
                    include[graph[0]] = {
                        include: {
                            [field[0]]: {
                                select: {
                                    [field[1]]: true
                                }
                            }
                        }
                    }
                } else {
                    include[graph[0]] = {
                        include: {
                            [graph[1]]: true
                        }
                    }
                }
            } else if(r.includes('@')) {
                const graph = r.split('@')
                include[graph[0]] = {
                    select: {
                        [graph[1]]: true
                    }
                }
            } else {
                include[r] = true
            }
        })
    }
    const model =  await prisma.permissions.findUnique({
        where: {
            id: id
        },
        include: include
    })
    if (model && !(skip && model.public)) {
        const auth = claims(event)
        if (model.hasOwnProperty('user') && event.possession.own && model.user !== auth.user) {
            throw error(403, 'Forbidden')
        } else if (((model.hasOwnProperty('user') && event.possession.any) ||
            (!model.hasOwnProperty('user') && event.possession.own)) && model.org !== auth.org) {
            throw error(403, 'Forbidden')
        }
    }
    return model
}

export async function GET(event) {
    const slug = event.params.slug

    if (slug.includes('metadata')) {
        const resource = slug.split('/')[1]
        return json(cache.get(resource ? resource : 'permissions'))
    }

    const model = await fetch(slug.split('/')[0], event, true, slug.split('/')[1])
    if (model) {
        return json(model)
    } else {
        throw error(404, model)
    }
}

export async function DELETE(event) {
    const id = event.params.slug
    const model = await fetch(id, event)
    if (!model) {
        throw error(404, model)
    }
    try {
        await prisma.permissions.delete({
            where: {
                id: id
            }
        });

        return json(model)
    } catch (e) {
        log.error(e)
        throw error(400, e)
    }
}

export async function PUT(event) {
    const id = event.params.slug
    if (!await fetch(id, event)) {
        throw error(404, null)
    }
    try {
        const data = await event.request.json();
        sanitize(data, ['org', 'creator', 'created', 'updated', 'user'])
        delete data['id']
        if (data.hasOwnProperty('public') && event.possession.own) {
            delete data.public
        }
        prepare(data, event)

        const model = await prisma.permissions.update({
            data: data,
            where: {
                id: id
            }
        });

        return json(model);
    } catch (e) {
        log.error(e)
        throw error(400, e)
    }
}
