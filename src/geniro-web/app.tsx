import { App } from "@fresh/core";
import { entity } from "./pages/entity.tsx";
import { search } from "./pages/search.tsx";
import { timeline } from "./pages/timeline.tsx";
import { tree } from "./pages/tree.tsx";

export const app = new App();

app.appWrapper((ctx) => (
    <html>
        <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>{ctx.state.title} · Geniro</title>
        </head>
        <body>
            <ctx.Component />
        </body>
    </html>
));

app.get("/", (ctx) => ctx.redirect("/search"));

app.mountApp("/", entity);
app.mountApp("/search", search);
app.mountApp("/tree", tree);
app.mountApp("/timeline", timeline);
