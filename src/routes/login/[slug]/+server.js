import {error, json} from "@sveltejs/kit";
import {prisma} from "$lib/prisma";
import {tenant} from "$lib/server/common.js";
import jwt from "jsonwebtoken";

async function fetch(id) {
    return await prisma.organizations.findUnique({
        where: {
            id: id
        }
    })
}

export async function GET(event) {
    const slug = event.params.slug

    if (!await fetch(slug)) {
        throw error(404, 'Unknown organization')
    }

    const auth = tenant(event)
    const payload = {
        sub: auth.user,
        user: auth.name,
        admin: auth.admin,
        org: slug,
        long: auth.long
    }
    const duration = auth.long ? import.meta.env.VITE_EXTENDED_SESSION : import.meta.env.VITE_DEFAULT_SESSION
    const token = jwt.sign(payload, import.meta.env.VITE_JWT_SECRET, {expiresIn: duration});

    return json(token);
}
