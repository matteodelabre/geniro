import { Application } from "@oak/oak/application";
import { Router } from "@oak/oak/router";
import { listenPort } from "./config.ts";
import { tree } from "./pages/tree.ts";
import { entity } from "./pages/entity.ts";
import { search } from "./pages/search.ts";

const app = new Application();
const index = new Router().get("/", (ctx) => ctx.response.redirect("/search"));

app.use(index.routes());
app.use(index.allowedMethods());
app.use(tree.routes());
app.use(tree.allowedMethods());
app.use(entity.routes());
app.use(entity.allowedMethods());
app.use(search.routes());
app.use(search.allowedMethods());

app.listen({ port: listenPort });
