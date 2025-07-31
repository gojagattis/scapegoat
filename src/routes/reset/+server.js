import {error, json} from "@sveltejs/kit";
import {prisma} from "$lib/prisma.js";
import bcrypt from "bcrypt";
import {claims} from "$lib/server/common.js";

export async function POST(event) {
    const data = await event.request.json()
    let user
    if (data.key) {
        user = await prisma.holding_area.findUnique({
            where: {
                key: data.key
            }
        })
        if (!user) {
            error(400, 'Invalid request')
        }
    } else {
        user = await prisma.users.findUnique({
            where: {
                id: (claims(event)).user
            }
        })
        const result = await bcrypt.compare(data.previous, user.password);
        if (!result) {
            throw error(400, `Incorrect existing password`)
        }
    }
    await prisma.users.update({
        data: {
            password: await bcrypt.hash(data.password, 10)
        },
        where: {
            username: user.username
        }
    })
    if (data.key) {
        await prisma.holding_area.deleteMany({
            where: {
                username: user.username
            }
        })
    }
    return json({message: 'Password reset.'})
}
