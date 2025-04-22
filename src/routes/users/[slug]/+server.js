import {error, json} from "@sveltejs/kit";
import {prisma} from "$lib/prisma";
import {log} from "$lib/logger.js";
import bcrypt from "bcrypt";
import { sanitize, prepare, graph } from '$lib/server/common.js';

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
        log.debug(`######### ${JSON.stringify(fields, null, 2)}`);
    }

    let model =  await prisma.users.findUnique({
        where: {
            id: slug
        },
        [include]: value
    })
    const permission = event.locals.permission
    if (permission && permission.possession === 'own') {
        if (model.owner !== event.locals.claims.sub) {
            error(403, 'Forbidden')
        }
    }
    if (model && permission && permission.attributes.length > 0) {
        if (!(permission.attributes.length === 1 && permission.attributes[0] === '*')) {
            model = permission.filter(model)
        }
    }

    if (model) {
        return json(model)
    } else {
        error(404, 'Not Found')
    }

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
    const id = event.params.slug
    if (!await fetch(id, event)) {
        throw error(404, null)
    }
    try {
        const data = await event.request.json();
        sanitize(data, ['org', 'creator', 'created', 'updated', 'user'])
        delete data['id']
        if (data.password) {
            data.password = await bcrypt.hash(data.password, 10)
        }
        if (data.hasOwnProperty('public') && event.possession.own) {
            delete data.public
        }
        prepare(data, event)

        const model = await prisma.users.update({
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
