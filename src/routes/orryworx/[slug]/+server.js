import {error, json} from "@sveltejs/kit";
import {prisma} from "$lib/prisma";
import {log} from "$lib/logger.js";
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

    let model =  await prisma[event.locals.resource].findUnique({
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
        if (model.creator !== event.locals.claims.sub) {
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
    const resource = event.locals.resource
    const slug = event.params.slug
    let model =  await prisma[resource].findUnique({
        where: {
            id: slug
        },
    })
    if (!model) {
        error(404, 'Not Found')
    }
    const permission = event.locals.permission
    if (permission && permission.possession === 'own') {
        if (model.creator !== event.locals.claims.sub) {
            error(403, 'Forbidden')
        }
    }
    await prisma[resource].delete({
        where: {
            id: slug
        }
    })

    return json({message: 'OK'})
}

export async function PUT(event) {
    const resource = event.locals.resource
    const slug = event.params.slug
    let model =  await prisma[resource].findUnique({
        where: {
            id: slug
        },
    })
    if (!model) {
        error(404, 'Not Found')
    }
    const permission = event.locals.permission
    if (permission && permission.possession === 'own') {
        if (model.creator !== event.locals.claims.sub) {
            error(403, 'Forbidden')
        }
    }
    const data = await event.request.json();
    sanitize(data)

    model = await prisma[resource].update({
        data: data,
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
