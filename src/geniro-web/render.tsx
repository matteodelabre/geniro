import * as preact from "preact-render-to-string";

/**
 * Render a virtual DOM tree and serve it as response to a request.
 *
 * @param ctx - Request context
 * @param args.title - Page title
 * @param args.content - Virtual DOM tree to render
 * @param args.partial - Pass true to disable rendering the HTML structure and only
 * render the inner content (default: true if and only if the `hx-request` header is
 * present).
 */
const render = (
    ctx,
    { title, content, partial },
) => {
    if (partial === undefined) {
        partial = ctx.request.headers.has("hx-request");
    }

    ctx.response.type = "text/html";

    if (partial) {
        ctx.response.body = preact.render(content);
    } else {
        const fullTitle = title ? <>{title} · Geniro</> : "Geniro";
        const page = (
            <html>
                <head>
                    <meta charset="utf-8" />
                    <meta
                        name="viewport"
                        content="width=device-width, initial-scale=1.0"
                    />
                    <title>{fullTitle}</title>
                    <link rel="stylesheet" href="/style.css" />
                </head>
                <body>
                    {content}
                </body>
            </html>
        );

        ctx.response.body = "<!doctype html>" + preact.render(page);
    }
};

export default render;
