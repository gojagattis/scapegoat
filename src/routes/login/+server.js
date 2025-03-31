import {error, json} from "@sveltejs/kit";
import {prisma} from "$lib/prisma.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

export async function POST(event) {
    const data = await event.request.json();
    const [user, roles] = await prisma.$transaction([
        prisma.users.findUnique({ where: { username: data.username } }),
        prisma.grants.findMany({ where: { user: data.username } }),
    ])

    if (!user.active) {
        error(401, 'User is deactivated.')
    }

    const result = await bcrypt.compare(data.password, user.password);
    if (!result) {
        error(401, 'Incorrect credentials.')
    } else {
        const payload = {
            sub: user.id,
            name: user.username,
            roles: roles
        }
        const duration = data.extend ? import.meta.env.VITE_EXTENDED_SESSION : import.meta.env.VITE_DEFAULT_SESSION
        const token = jwt.sign(payload, import.meta.env.VITE_JWT_SECRET, {expiresIn: duration});

        return json(token);
    }
}
