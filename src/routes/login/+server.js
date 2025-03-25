import {error, json} from "@sveltejs/kit";
import {prisma} from "$lib/prisma.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import {header, tenant} from "$lib/server/common.js";

const msg = 'Invalid username or password';

export async function GET(event) {
    const token = header(event)
    if (!token) {
        throw error(401, 'An authorization bearer header with a valid jwt token is required to access the resource')
    } else {
        try {
            jwt.verify(token, import.meta.env.VITE_JWT_SECRET);
            const auth = tenant(event)
            const payload = {
                sub: auth.user,
                user: auth.name,
                admin: auth.admin,
                org: auth.org,
                long: auth.long
            }
            const duration = auth.long ? import.meta.env.VITE_EXTENDED_SESSION : import.meta.env.VITE_DEFAULT_SESSION
            return json(jwt.sign(payload, import.meta.env.VITE_JWT_SECRET, {expiresIn: duration}))
        } catch (e) {
            throw error(401, e)
        }
    }
}

async function login(user, remember = false) {
    const payload = {
        sub: user.id,
        user: user.username,
        admin: !!user.roles.find(r => r.admin === true),
        org: user.org,
        long: remember
    }
    const duration = remember ? import.meta.env.VITE_EXTENDED_SESSION : import.meta.env.VITE_DEFAULT_SESSION
    const token = jwt.sign(payload, import.meta.env.VITE_JWT_SECRET, {expiresIn: duration});

    return json(token);
}

export async function POST(event) {
    const data = await event.request.json();
    let users = await prisma.users.findMany({
        where: {
            username: data.username
        },
        include: {
            roles: true
        }
    })
    users = Array.from(users)

    if (users.length === 0) {
        throw error(401, msg)
    }
    if (users.length === 1) {
        const user = users[0]
        const result = await bcrypt.compare(data.password, user.password);
        if (!result) {
            throw error(401, msg)
        } else {
            return login(user, data.remember)
        }
    }
    if (users.length > 1) {
        for (const user of users) {
            const result = await bcrypt.compare(data.password, user.password);
            if (result) {
                return login(user, data.remember)
            }
        }
        throw error(401, msg)
    }
}
