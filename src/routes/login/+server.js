import {error, json} from "@sveltejs/kit";
import {prisma} from "$lib/prisma.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

export async function POST(event) {
    const data = await event.request.json();
    if (!data.username) {
        error(401, 'Missing required fields')
    }

    const user = await prisma.users.findUnique({
        where: {
            username: data.username
        },
        include: {
            roles: true
        }
    })

    if (!user || !user.active) {
        error(404, 'Unknown or deactivated user')
    }

    const result = await bcrypt.compare(data.password, user.password);
    if (!result) {
        error(401, 'Incorrect credentials')
    } else {
        const payload = {
            sub: user.id,
            name: user.username,
            roles: user.roles.map(role => { return role.name })
        }
        const duration = data.extend ? import.meta.env.VITE_EXTENDED_SESSION : import.meta.env.VITE_DEFAULT_SESSION
        const token = jwt.sign(payload, import.meta.env.VITE_JWT_SECRET, {expiresIn: duration});

        return json(token);
    }
}
