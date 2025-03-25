import {PrismaClient} from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient()

async function main() {
    await prisma.$executeRaw`CREATE TRIGGER IF NOT EXISTS org_id AFTER INSERT ON organizations 
        FOR EACH ROW
        BEGIN
        UPDATE organizations SET org = new.id WHERE id = new.id;
        END;`;

    await prisma.$executeRaw`CREATE TRIGGER IF NOT EXISTS user_id_insert AFTER INSERT ON users 
        FOR EACH ROW
        BEGIN
        UPDATE users SET user = new.id WHERE id = new.id;
        END;`;

    await prisma.$executeRaw`CREATE TRIGGER IF NOT EXISTS user_id_update AFTER UPDATE ON users 
        FOR EACH ROW
        BEGIN
        UPDATE users SET user = new.id WHERE id = new.id AND user != new.id;
        END;`;

    const orgs = await prisma.organizations.findMany({})
    if (Array.from(orgs).length === 0) {
        let org = await prisma.organizations.upsert({
            where: { name: 'Acme' },
            update: {},
            create: {
                name: 'Acme',
                org: 'temp',
                creator: 'temp',
            },
        })

        let user = await prisma.users.upsert({
            where: {
                username_org: {
                    username: 'admin',
                    org: org.id,
                },
            },
            update: {},
            create: {
                username: 'admin',
                password: await bcrypt.hash('admin', 10),
                org: org.id,
                creator: 'temp',
            },
        })

        org = await prisma.organizations.update({
            data: {
                creator: user.id,
            },
            where: {
                id: org.id
            }
        })

        const sa_role = await prisma.roles.upsert({
            where: { name: 'System Admin' },
            update: {},
            create: {
                name: 'System Admin',
                public: false,
                default: false,
                admin: true,
                org: org.id,
                creator: user.id,
            },
        })

        const user_role = await prisma.roles.upsert({
            where: { name: 'User' },
            update: {},
            create: {
                name: 'User',
                public: true,
                default: true,
                admin: false,
                org: org.id,
                creator: user.id,
            },
        })

        user = await prisma.users.update({
            data: {
                creator: user.id,
                roles: {
                    connect: {
                        id: sa_role.id
                    }
                }
            },
            where: {
                username_org: {
                    username: 'admin',
                    org: org.id,
                },
            },
        })

        const resources = []
        const models = prisma['_runtimeDataModel']['models']
        Object.keys(models).forEach(m => {if (!m.includes('_')) resources.push(m)})
        const actions = ['create:any', 'read:any', 'update:any', 'delete:any']

        for (const resource of resources) {
            for (const action of actions) {
                try {
                    await prisma.permissions.create({
                        data: {
                            role: 'System Admin',
                            resource: resource,
                            action: action,
                            org: org.id,
                            creator: user.id,
                        },
                    });
                } catch (e) {
                    console.log(e)
                }
            }
        }

        try {
            await prisma.permissions.create({
                data: {
                    role: 'System Admin',
                    resource: 'login',
                    action: 'read:any',
                    org: org.id,
                    creator: user.id,
                },
            });
            await prisma.permissions.create({
                data: {
                    role: 'System Admin',
                    resource: 'resources',
                    action: 'read:any',
                    org: org.id,
                    creator: user.id,
                },
            });
            await prisma.permissions.create({
                data: {
                    role: 'System Admin',
                    resource: 'privileges',
                    action: 'read:any',
                    org: org.id,
                    creator: user.id,
                },
            });
            await prisma.permissions.create({
                data: {
                    role: 'System Admin',
                    resource: 'config',
                    action: 'read:any',
                    org: org.id,
                    creator: user.id,
                },
            });
            await prisma.permissions.create({
                data: {
                    role: 'User',
                    resource: 'organizations',
                    action: 'read:own',
                    org: org.id,
                    creator: user.id,
                },
            });
            await prisma.permissions.create({
                data: {
                    role: 'User',
                    resource: 'users',
                    action: 'read:own',
                    org: org.id,
                    creator: user.id,
                },
            });
            await prisma.permissions.create({
                data: {
                    role: 'User',
                    resource: 'config',
                    action: 'read:own',
                    org: org.id,
                    creator: user.id,
                },
            });
        } catch (e) {
            console.log(e)
        }

        console.log({ org, user, role: sa_role })
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
