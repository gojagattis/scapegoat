import {PrismaClient} from "@prisma/client";
import bcrypt from "bcrypt";
import { createId } from '@paralleldrive/cuid2';

const prisma = new PrismaClient()
const exclude = ['litestream_lock', 'litestream_seq']

async function main() {
    const users = await prisma.users.findMany({})
    if (users.length === 0) {
        let id = createId()
        const sa = await prisma.users.create({
            data: {
                id: id,
                username: 'admin',
                password: await bcrypt.hash('admin', 10),
                owner: id,
            },
        })

        id = createId()
        await prisma.users.create({
            data: {
                id: id,
                username: 'demo',
                password: await bcrypt.hash('demo', 10),
                owner: id,
            },
        })

        const admin = await prisma.roles.create({
            data: {
                name: 'Admin',
                owner: sa.id,
            },
        })

        const user = await prisma.roles.create({
            data: {
                name: 'User',
                owner: sa.id,
            },
        })

        await prisma.grants.create({
            data: {
                user: 'admin',
                role: 'Admin',
                owner: sa.id,
            },
        })

        await prisma.grants.create({
            data: {
                user: 'demo',
                role: 'User',
                owner: sa.id,
            },
        })

        const resources = []
        const models = prisma['_runtimeDataModel']['models']
        Object.keys(models).forEach(m => {if (!exclude.includes(m)) resources.push(m)})
        const actions = ['create:any', 'read:any', 'update:any', 'delete:any']

        for (const resource of resources) {
            for (const action of actions) {
                try {
                    await prisma.permissions.create({
                        data: {
                            role: 'Admin',
                            resource: resource,
                            action: action,
                            attributes: resource === 'users' && action === 'read:any' ? '*, !password' : '*',
                            owner: sa.id,
                        },
                    });
                } catch (e) {
                    console.log(e)
                }
            }
        }

        await prisma.permissions.create({
            data: {
                role: 'Admin',
                resource: 'privileges',
                action: 'read:any',
                owner: sa.id,
            },
        })

        await prisma.permissions.create({
            data: {
                role: 'User',
                resource: 'users',
                action: 'read:own',
                attributes: '*, !password',
                owner: sa.id,
            },
        })

        await prisma.permissions.create({
            data: {
                role: 'User',
                resource: 'users',
                action: 'update:own',
                owner: sa.id,
            },
        })

        await prisma.permissions.create({
            data: {
                role: 'User',
                resource: 'users',
                action: 'delete:own',
                owner: sa.id,
            },
        })

    }
}
main()
    .then(async () => {
        await prisma.$disconnect()
    })
    .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
        process.exit(1)
    })
