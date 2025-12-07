import rdf from "@rdfjs/data-model";
import { assertEquals } from "@std/assert";
import { processRecord } from "./oai-pmh.ts";
import { dcterms, foaf, geniro, owl, rdf as rdfns, time, xsd } from "../data/model.ts";
import * as xml from "./xml.ts";

Deno.test("should extract triples from record", () => {
    const record = xml.parse(`
        <record
            xmlns="http://www.openarchives.org/OAI/2.0/"
            xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
            <header>
                <identifier>oai:umontreal.scholaris.ca:1866/30688</identifier>
                <datestamp>2025-02-13T02:29:35Z</datestamp>
                <setSpec>com_1866_2958</setSpec>
                <setSpec>com_1866_3010</setSpec>
                <setSpec>com_1866_2620</setSpec>
                <setSpec>col_1866_3001</setSpec>
                <setSpec>col_1866_2621</setSpec>
            </header>
            <metadata>
                <thesis
                    xmlns="http://www.ndltd.org/standards/metadata/etdms/1.1/"
                    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                    xmlns:dc="http://purl.org/dc/elements/1.1/"
                    xmlns:dcterms="http://purl.org/dc/terms/"
                    xmlns:doc="http://www.lyncode.com/xoai">
                    <title>Covérification des systèmes intégrés</title>
                    <creator resource="https://orcid.org/0000-0003-2823-504X">Azizi, Mostafa</creator>
                    <subject>Covérification L/M</subject>
                    <subject>Vérification formelle</subject>
                    <subject>Cosimulation</subject>
                    <subject>Propriétés</subject>
                    <subject>Systèmes L/M</subject>
                    <subject>Simulation séquentielle</subject>
                    <subject>Simulation distribuée</subject>
                    <subject>Spécification</subject>
                    <subject>Test</subject>
                    <description role="note">Thèse numérisée par la Direction des bibliothèques de l'Université de Montréal.</description>
                    <publisher country="Canada">Université de Montréal</publisher>
                    <contributor role="directeur(trice) de recherche/advisor">Aboulhamid, El Mostapha</contributor>
                    <contributor role="directeur(trice) de recherche/advisor">Tabar, Sofiene</contributor>
                    <date>2000</date>
                    <type xml:lang="fr">Thèse ou mémoire numérique</type>
                    <type xml:lang="en">Electronic Thesis or Dissertation</type>
                    <identifier>http://hdl.handle.net/1866/30688</identifier>
                    <identifier>https://umontreal.scholaris.ca/bitstreams/5f2249b6-3bd4-4cbe-9ea3-c05c87f9c1b8/download</identifier>
                    <format>application/pdf</format>
                    <language xsi:type="dcterms:ISO639-3">fra</language>
                    <rights>© Mostafa Azizi, 2000</rights>
                    <degree>
                        <name>Ph. D.</name>
                        <level xml:lang="fr">Doctorat</level>
                        <level xml:lang="en">Doctoral</level>
                        <discipline xml:lang="fr">Informatique</discipline>
                        <grantor xml:lang="fr">Université de Montréal</grantor>
                    </degree>
                </thesis>
            </metadata>
        </record>
    `);

    const origin = "example.org";
    const grantor = rdf.namedNode("http://example.org/org/example");
    const project = rdf.namedNode("oai:umontreal.scholaris.ca:1866/30688");
    const student = rdf.namedNode(
        "http://diro.umontreal.ca/geniro/external/example.org/person/mostafa-azizi",
    );
    const advisor1 = rdf.namedNode(
        "http://diro.umontreal.ca/geniro/external/example.org/person/el-mostapha-aboulhamid",
    );
    const advisor2 = rdf.namedNode(
        "http://diro.umontreal.ca/geniro/external/example.org/person/sofiene-tabar",
    );

    const triples = Array.from(processRecord(record, origin, grantor));
    assertEquals(triples[0], [project, geniro.grantedBy, grantor]);
    assertEquals(triples[1], [project, rdfns.type, geniro.PhDProject]);
    assertEquals(triples[2], [
        project,
        dcterms.title,
        rdf.literal("Covérification des systèmes intégrés"),
    ]);

    const timeNode = triples[3][2];
    assertEquals(triples[3], [project, geniro.timePeriod, timeNode]);

    const timeEndNode = triples[4][2];
    assertEquals(triples[4], [timeNode, time.hasEnd, timeEndNode]);
    assertEquals(triples[5], [
        timeEndNode,
        time.inXSDDate,
        rdf.literal("2000-01-01", xsd.date),
    ]);

    assertEquals(triples[6], [student, rdfns.type, foaf.Person]);
    assertEquals(triples[7], [project, geniro.student, student]);
    assertEquals(triples[8], [student, foaf.firstName, rdf.literal("Mostafa")]);
    assertEquals(triples[9], [student, foaf.lastName, rdf.literal("Azizi")]);
    assertEquals(triples[10], [
        student,
        owl.sameAs,
        rdf.namedNode("https://orcid.org/0000-0003-2823-504X"),
    ]);
    assertEquals(triples[11], [advisor1, rdfns.type, foaf.Person]);
    assertEquals(triples[12], [project, geniro.advisor, advisor1]);
    assertEquals(triples[13], [advisor1, foaf.firstName, rdf.literal("El Mostapha")]);
    assertEquals(triples[14], [advisor1, foaf.lastName, rdf.literal("Aboulhamid")]);
    assertEquals(triples[15], [advisor2, rdfns.type, foaf.Person]);
    assertEquals(triples[16], [project, geniro.advisor, advisor2]);
    assertEquals(triples[17], [advisor2, foaf.firstName, rdf.literal("Sofiene")]);
    assertEquals(triples[18], [advisor2, foaf.lastName, rdf.literal("Tabar")]);
    assertEquals(triples[19], [
        project,
        geniro.thesis,
        rdf.namedNode("http://hdl.handle.net/1866/30688"),
    ]);
});
