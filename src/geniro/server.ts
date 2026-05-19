import { listenPort } from "./config.ts";
import { app } from "./app.tsx";

app.listen({ port: listenPort });
