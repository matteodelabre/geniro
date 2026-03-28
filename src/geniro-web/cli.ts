import * as builder from "./data/builder.ts";
import * as oaiPmh from "./fetcher/oai-pmh.ts";
import * as mathgenData from "./fetcher/mathgen/update.ts";
import * as mathgenApi from "./fetcher/mathgen/api.ts";
import * as link from "./fetcher/link.ts";
import * as sparql from "./data/sparql.ts";
import { databaseEndpoint, mathgenLogin, mathgenPassword } from "./config.ts";
import { foaf, geniro, getOrganizationURI, org } from "./data/model.ts";

const fetchOaiPmh = async (baseUrl, baseSet, grantorUri) => {
    await sparql.update(
        databaseEndpoint,
        builder.insertData(
            await Array.fromAsync(
                oaiPmh.fetchRecords(baseUrl, baseSet, grantorUri),
            ),
        ),
    );
};

const fetchMathgen = async () => {
    const schoolIds = JSON.parse(await Deno.readTextFile("mathgenschools.json"));
    const token = await mathgenApi.getToken(mathgenLogin, mathgenPassword);

    while (true) {
        const pending = await mathgenData.findExpiredPersons();

        if (pending.length === 0) {
            break;
        }

        await mathgenData.refresh(token, schoolIds, pending);
    }
};

const fixUnidentified = async () => {
    for (const type of [foaf.Person, geniro.Project, org.Organization]) {
        for (const item of await link.findUnidentified(type)) {
            const preferredUri = await link.addPreferredUri(type, item);
            console.log(`Added preferred URI ${preferredUri.value} to ${item.value}`);
        }
    }
};

const main = async () => {
    if (Deno.args.length < 1) {
        console.error("available commands: fetch-oai-pmh, fetch-mathgen, fix-unidentified");
        return;
    }

    switch (Deno.args[0]) {
        case "fetch-oai-pmh":
            await fetchOaiPmh(
                new URL("https://umontreal.scholaris.ca/server/oai/request"),
                "col_1866_3001",
                getOrganizationURI("diro"),
            );
            break;

        case "fetch-mathgen":
            await fetchMathgen();
            break;

        case "fix-unidentified":
            await fixUnidentified();
            break;

        default:
            console.error(`unknown command ${Deno.args[0]}`);
    }
};

await main();
