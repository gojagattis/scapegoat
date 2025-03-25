import {error, json} from "@sveltejs/kit";
import {prisma} from "$lib/prisma.js";
import bcrypt from "bcrypt";
import {tenant} from "$lib/server/common.js";

export async function POST(event) {
    const data = await event.request.json()
    let user
    if (data.nonce) {
        user = await prisma.temp.findUnique({
            where: {
                nonce: data.nonce
            }
        })
        if (!user) {
            throw error(400, 'Invalid request')
        }
    } else {
        user = await prisma.users.findUnique({
            where: {
                id: (tenant(event)).user
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
            id: user.id ? user.id : user.userId
        }
    })
    if (data.nonce) {
        await prisma.temp.deleteMany({
            where: {
                username: user.username
            }
        })
    }
    return json({message: user.id ? 'Password reset successfully.' : 'Password reset.\nLogin to continue.'})
}
