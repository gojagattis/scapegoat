import {error, json} from "@sveltejs/kit";
import {prisma} from "$lib/prisma";
import {log} from "$lib/logger.js";
import bcrypt from "bcrypt";
import { sanitize, prepare, graph, cache } from '$lib/server/common.js';

export async function GET(event) {
    const slug = event.params.slug
    let fields
    let include = 'include'
    let value = {}

    fields = graph(Object.fromEntries(event.url.searchParams))
    if (fields) {
        const [k, v] = (Object.entries(fields))[0]
        include = k
        value = v
    }

    let model =  await prisma.users.findUnique({
        where: {
            id: slug
        },
        [include]: value
    })
    if (!model) {
        error(404, 'Not Found')
    }
    const permission = event.locals.permission
    if (permission && permission.possession === 'own') {
        if (model.id !== event.locals.claims.sub) {
            error(403, 'Forbidden')
        }
    }
    if (permission && permission.attributes.length > 0) {
        if (!(permission.attributes.length === 1 && permission.attributes[0] === '*')) {
            model = permission.filter(model)
        }
    }

    return json(model)

}

export async function DELETE(event) {
    const id = event.params.slug
    const model = await fetch(id, event)
    if (!model) {
        throw error(404, model)
    }
    try {
        await prisma.users.delete({
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
    const slug = event.params.slug
    let model =  await prisma.users.findUnique({
        where: {
            id: slug
        },
    })
    if (!model) {
        error(404, 'Not Found')
    }
    const permission = event.locals.permission
    if (permission && permission.possession === 'own') {
        if (model.id !== event.locals.claims.sub) {
            error(403, 'Forbidden')
        }
    }
    const data = await event.request.json();
    const system = ['id', 'creator', 'created', 'updated', 'password']
    if (data.password && data.password.trim()) { //hash password if it is plaintext
        try {
            await bcrypt.getRounds(data.password) //will fail for plain text
        } catch (e) {
            model.password = await bcrypt.hash(data.password, 10)
        }
    }
    const schema = cache.get(event.url.pathname.split('/')[1])
    schema.forEach(s => {
        if (s.kind === 'scalar' && !system.includes(s.name) && data.hasOwnProperty(s.name)
                && (s.type !== 'String' || (s.type === 'String' && data[s.name].trim()))) {
            model[s.name] = data[s.name]
        }
    })

    model = await prisma.users.update({
        data: model,
        where: {
            id: slug
        }
    })
    if (permission && permission.attributes.length > 0) {
        if (!(permission.attributes.length === 1 && permission.attributes[0] === '*')) {
            model = permission.filter(model)
        }
    }

    return json(model)
}
