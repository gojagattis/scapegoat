import {json} from "@sveltejs/kit";

export async function GET(event) {
    const config = {
        pageSize: parseInt(import.meta.env.VITE_PAGE_SIZE)
    }

    return json(config)
}
