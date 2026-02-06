import { Application, Router, send } from "@oak/oak";
import * as path from "@std/path";
import { isHttpError } from "@oak/commons/http_errors";
import { entity } from "./pages/entity.tsx";
import { person } from "./pages/person.tsx";
import { project } from "./pages/project.tsx";
import { search } from "./pages/search.tsx";
import { timeline } from "./pages/timeline.tsx";
import { tree } from "./pages/tree.tsx";

export const app = new Application();

// handle and present errors
app.use(async (ctx, next) => {
    try {
        await next();
    } catch (err) {
        if (isHttpError(err)) {
            ctx.response.with(err.asResponse({ request: ctx.request }));
        } else {
            ctx.response.status = 500;
            ctx.response.type = "text";
            ctx.response.body = "Internal server error";
            console.error(err);
        }
    }
});

// serve static files
const staticRoot = path.join(import.meta.dirname, "static");

app.use(async (ctx, next) => {
    const pathname = ctx.request.url.pathname;

    if (pathname !== "/") {
        try {
            await send(ctx, pathname, { root: staticRoot });
        } catch (_) {
            await next();
        }
    } else {
        await next();
    }
});

// serve normal pages
const router = new Router();

router.get("/", (ctx) => ctx.response.redirect("/search"));
router.use("", entity.routes());
router.use("/person", person.routes());
router.use("/project", project.routes());
router.use("/search", search.routes());
router.use("/timeline", timeline.routes());
router.use("/tree", tree.routes());

app.use(router.routes());
