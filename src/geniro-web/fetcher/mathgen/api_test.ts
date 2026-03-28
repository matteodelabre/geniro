import rdf from "@rdfjs/data-model";
import { assertEquals } from "@std/assert";
import { processRecord } from "./api.ts";
import { mathgenRefreshDelay, mathgenRefreshDelaySpread } from "../../config.ts";
import { dcterms, foaf, geniro, owl, org, skos, rdf as rdfns, time, xsd } from "../../data/model.ts";

Deno.test("should extract triples from record", () => {
    const schoolIds = {
        "Cornell University, United States": "42",
    };

    const record = {
        "ID": "73123",
        "family_name": "Brassard",
        "given_name": "Gilles",
        "mrauth_id": "41075",
        "other_names": "",
        "student_data": {
            "degrees": [
                {
                    "advised by": {
                        "73697": "Hopcroft, John Edward H."
                    },
                    "degree_msc": "Unknown",
                    "degree_type": "Ph.D.",
                    "degree_year": "1979",
                    "schools": [
                        "Cornell University, United States"
                    ],
                    "thesis_title": "Relativized Cryptography"
                }
            ],
            "descendants": {
                "advisees": [
                    ["73138", "Tapp, Alain"],
                    ["73181", "Mayers, Dominic"],
                    ["73200", "Berthiaume, Andre"],
                    ["107910", "Fernandez, José Manuel"],
                    ["128521", "Broadbent, Anne"],
                    ["147383", "Gambs, Sébastien"],
                    ["190517", "Marcoux, Yves"],
                    ["198788", "Dupuis, Frederic"],
                    ["124702", "Salvail, Louis"],
                    ["24124", "Paquet, Sebastian"],
                ],
                "descendant_count": 14
            }
        }
    };

    const studentNode = rdf.namedNode("http://mathgenealogy.org/id.php?id=73123");
    const advisorNode = rdf.namedNode("http://mathgenealogy.org/id.php?id=73697");
    const refreshNode = rdf.namedNode(
        "http://diro.umontreal.ca/geniro/external/mathgenealogy.org"
        + "/refresh/73123"
    );
    const projectNode = rdf.namedNode(
        "http://diro.umontreal.ca/geniro/external/mathgenealogy.org"
        + "/project/73123-1979"
    );
    const timeNode = rdf.namedNode(
        "http://diro.umontreal.ca/geniro/external/mathgenealogy.org"
        + "/project/73123-1979#timePeriod"
    );
    const timeEndNode = rdf.namedNode(
        "http://diro.umontreal.ca/geniro/external/mathgenealogy.org"
        + "/project/73123-1979#timePeriod/end"
    );
    const schoolNode = rdf.namedNode(
        "http://diro.umontreal.ca/geniro/external/mathgenealogy.org"
        + "/school/42"
    );

    const triples = Array.from(processRecord(record, schoolIds));

    // Check that the expiration date is between the configured bounds
    assertEquals(triples[5][0], refreshNode);
    assertEquals(triples[5][1], geniro.expires);

    const refreshDate = Temporal.Instant.from(triples[5][2].value);
    const now = Temporal.Now.instant();
    const minRefreshDate = now.add(mathgenRefreshDelay).subtract(mathgenRefreshDelaySpread);
    const maxRefreshDate = now.add(mathgenRefreshDelay).add(mathgenRefreshDelaySpread);

    assertEquals(Temporal.Instant.compare(minRefreshDate, refreshDate), -1);
    assertEquals(Temporal.Instant.compare(refreshDate, maxRefreshDate), -1);

    // Check other triples
    assertEquals(triples.slice(0, 5).concat(triples.slice(6)), [
        [studentNode, rdfns.type, foaf.Person],
        [studentNode, foaf.firstName, rdf.literal("Gilles")],
        [studentNode, foaf.lastName, rdf.literal("Brassard")],
        [studentNode, owl.sameAs, rdf.namedNode("http://mathscinet.ams.org/mathscinet/author?authorId=41075")],
        [refreshNode, geniro.preferredUri, rdf.literal(studentNode.value)],
        [projectNode, geniro.student, studentNode],
        [projectNode, rdfns.type, geniro.PhDProject],
        [projectNode, dcterms.title, rdf.literal("Relativized Cryptography")],
        [projectNode, geniro.grantedBy, schoolNode],
        [schoolNode, rdfns.type, org.Organization],
        [schoolNode, skos.prefLabel, rdf.literal("Cornell University")],
        [projectNode, geniro.advisor, advisorNode],
        [advisorNode, rdfns.type, foaf.Person],
        [projectNode, geniro.timePeriod, timeNode],
        [timeNode, time.hasEnd, timeEndNode],
        [timeEndNode, time.inXSDDate, rdf.literal("1979-01-01", xsd.date)],
    ]);
});

Deno.test("process record with no advisor", () => {
    const schoolIds = {
        "Martin-Luther-Universität Halle-Wittenberg, Germany": "42",
    };

    const record = {
        "ID": "230796",
        "family_name": "Ziegra",
        "given_name": "Constantin",
        "mrauth_id": "",
        "other_names": "",
        "student_data": {
            "degrees": [
                {
                    "advised by": {
                        "0": "Unknown"
                    },
                    "degree_msc": "Unknown",
                    "degree_type": "M.A.",
                    "degree_year": "1640",
                    "schools": [
                        "Martin-Luther-Universität Halle-Wittenberg, Germany"
                    ],
                    "thesis_title": "Unknown"
                }
            ],
            "descendants": {
                "advisees": [
                    ["127962", "Walther, Michael d. J."]
                ],
                "descendant_count": 168528
            }
        }
    };

    const studentNode = rdf.namedNode("http://mathgenealogy.org/id.php?id=230796");
    const refreshNode = rdf.namedNode(
        "http://diro.umontreal.ca/geniro/external/mathgenealogy.org"
        + "/refresh/230796"
    );
    const projectNode = rdf.namedNode(
        "http://diro.umontreal.ca/geniro/external/mathgenealogy.org"
        + "/project/230796-1640"
    );
    const timeNode = rdf.namedNode(
        "http://diro.umontreal.ca/geniro/external/mathgenealogy.org"
        + "/project/230796-1640#timePeriod"
    );
    const timeEndNode = rdf.namedNode(
        "http://diro.umontreal.ca/geniro/external/mathgenealogy.org"
        + "/project/230796-1640#timePeriod/end"
    );
    const schoolNode = rdf.namedNode(
        "http://diro.umontreal.ca/geniro/external/mathgenealogy.org"
        + "/school/42"
    );

    const triples = Array.from(processRecord(record, schoolIds));
    assertEquals(triples.slice(0, 4).concat(triples.slice(5)), [
        [studentNode, rdfns.type, foaf.Person],
        [studentNode, foaf.firstName, rdf.literal("Constantin")],
        [studentNode, foaf.lastName, rdf.literal("Ziegra")],
        [refreshNode, geniro.preferredUri, rdf.literal(studentNode.value)],
        [projectNode, geniro.student, studentNode],
        [projectNode, rdfns.type, geniro.PhDProject],
        [projectNode, dcterms.title, rdf.literal("Unknown")],
        [projectNode, geniro.grantedBy, schoolNode],
        [schoolNode, rdfns.type, org.Organization],
        [schoolNode, skos.prefLabel, rdf.literal("Martin-Luther-Universität Halle-Wittenberg")],
        [projectNode, geniro.timePeriod, timeNode],
        [timeNode, time.hasEnd, timeEndNode],
        [timeEndNode, time.inXSDDate, rdf.literal("1640-01-01", xsd.date)],
    ]);
});

Deno.test("process record with unknown degree date", () => {
    const schoolIds = {
        "École Normale Supérieure, France": "42",
    };

    const record = {
        "ID": "17981",
        "family_name": "Fourier",
        "given_name": "Jean-Baptiste",
        "mrauth_id": "249547",
        "other_names": "Joseph",
        "student_data": {
            "degrees": [
                {
                    "advised by": {
                        "17864": "Lagrange, Joseph Louis"
                    },
                    "degree_msc": "33",
                    "degree_type": "Ph.D.",
                    "degree_year": "Unknown",
                    "schools": [
                        "École Normale Supérieure, France"
                    ],
                    "thesis_title": "Unknown"
                }
            ],
            "descendants": {
                "advisees": [
                    ["43262", "Plana, Giovanni Antonio Amedeo"],
                    ["17946", "Dirichlet, Gustav Peter Lejeune"]
                ],
                "descendant_count": 93352
            }
        }
    };

    const studentNode = rdf.namedNode("http://mathgenealogy.org/id.php?id=17981");
    const advisorNode = rdf.namedNode("http://mathgenealogy.org/id.php?id=17864");
    const refreshNode = rdf.namedNode(
        "http://diro.umontreal.ca/geniro/external/mathgenealogy.org"
        + "/refresh/17981"
    );
    const projectNode = rdf.namedNode(
        "http://diro.umontreal.ca/geniro/external/mathgenealogy.org"
        + "/project/17981-unknown"
    );
    const schoolNode = rdf.namedNode(
        "http://diro.umontreal.ca/geniro/external/mathgenealogy.org"
        + "/school/42"
    );

    const triples = Array.from(processRecord(record, schoolIds));
    assertEquals(triples.slice(0, 5).concat(triples.slice(6)), [
        [studentNode, rdfns.type, foaf.Person],
        [studentNode, foaf.firstName, rdf.literal("Jean-Baptiste")],
        [studentNode, foaf.lastName, rdf.literal("Fourier")],
        [studentNode, owl.sameAs, rdf.namedNode("http://mathscinet.ams.org/mathscinet/author?authorId=249547")],
        [refreshNode, geniro.preferredUri, rdf.literal(studentNode.value)],
        [projectNode, geniro.student, studentNode],
        [projectNode, rdfns.type, geniro.PhDProject],
        [projectNode, dcterms.title, rdf.literal("Unknown")],
        [projectNode, geniro.grantedBy, schoolNode],
        [schoolNode, rdfns.type, org.Organization],
        [schoolNode, skos.prefLabel, rdf.literal("École Normale Supérieure")],
        [projectNode, geniro.advisor, advisorNode],
        [advisorNode, rdfns.type, foaf.Person],
    ]);
});

Deno.test("process record with multiple years in degree field", () => {
    const schoolIds = {
        "Universität Basel, Switzerland": "42",
    };

    const record = {
        "ID": "53410",
        "family_name": "Bernoulli",
        "given_name": "Johann",
        "mrauth_id": "35690",
        "other_names": "",
        "student_data": {
            "degrees": [
                {
                    "advised by": {
                        "129628": "Eglinger, Nikolaus",
                        "54440": "Bernoulli, Jacob"
                    },
                    "degree_msc": "92",
                    "degree_type": "Medicinae Dr.",
                    "degree_year": "1690, 1694",
                    "schools": [
                        "Universität Basel, Switzerland"
                    ],
                    "thesis_title": "Dissertatio de effervescentia et fermentatione; Dissertatio Inauguralis Physico-Anatomica de Motu Musculorum"
                }
            ],
            "descendants": {
                "advisees": [
                    ["113403", "Hoorn, Henricus Casimirus"],
                    ["110897", "König, Samuel"],
                    ["235010", "Maupertuis, Pierre Louis"],
                    ["38586", "Euler, Leonhard"],
                    ["108998", "Bernoulli, Daniel"],
                ],
                "descendant_count": 172869
            }
        }
    };

    const studentNode = rdf.namedNode("http://mathgenealogy.org/id.php?id=53410");
    const advisor1Node = rdf.namedNode("http://mathgenealogy.org/id.php?id=54440");
    const advisor2Node = rdf.namedNode("http://mathgenealogy.org/id.php?id=129628");
    const refreshNode = rdf.namedNode(
        "http://diro.umontreal.ca/geniro/external/mathgenealogy.org"
        + "/refresh/53410"
    );
    const projectNode = rdf.namedNode(
        "http://diro.umontreal.ca/geniro/external/mathgenealogy.org"
        + "/project/53410-1694"
    );
    const timeNode = rdf.namedNode(
        "http://diro.umontreal.ca/geniro/external/mathgenealogy.org"
        + "/project/53410-1694#timePeriod"
    );
    const timeEndNode = rdf.namedNode(
        "http://diro.umontreal.ca/geniro/external/mathgenealogy.org"
        + "/project/53410-1694#timePeriod/end"
    );
    const schoolNode = rdf.namedNode(
        "http://diro.umontreal.ca/geniro/external/mathgenealogy.org"
        + "/school/42"
    );

    const triples = Array.from(processRecord(record, schoolIds));
    assertEquals(triples.slice(0, 5).concat(triples.slice(6)), [
        [studentNode, rdfns.type, foaf.Person],
        [studentNode, foaf.firstName, rdf.literal("Johann")],
        [studentNode, foaf.lastName, rdf.literal("Bernoulli")],
        [studentNode, owl.sameAs, rdf.namedNode("http://mathscinet.ams.org/mathscinet/author?authorId=35690")],
        [refreshNode, geniro.preferredUri, rdf.literal(studentNode.value)],
        [projectNode, geniro.student, studentNode],
        [projectNode, rdfns.type, geniro.PhDProject],
        [projectNode, dcterms.title, rdf.literal("Dissertatio de effervescentia et fermentatione; Dissertatio Inauguralis Physico-Anatomica de Motu Musculorum")],
        [projectNode, geniro.grantedBy, schoolNode],
        [schoolNode, rdfns.type, org.Organization],
        [schoolNode, skos.prefLabel, rdf.literal("Universität Basel")],
        [projectNode, geniro.advisor, advisor1Node],
        [advisor1Node, rdfns.type, foaf.Person],
        [projectNode, geniro.advisor, advisor2Node],
        [advisor2Node, rdfns.type, foaf.Person],
        [projectNode, geniro.timePeriod, timeNode],
        [timeNode, time.hasEnd, timeEndNode],
        [timeEndNode, time.inXSDDate, rdf.literal("1694-01-01", xsd.date)],
    ]);
});

// 158085 - Segner Johann -> multiple degree entries
Deno.test("process record with multiple years in degree field", () => {
    const schoolIds = {
        "Friedrich-Schiller-Universität Jena, Germany": "42",
    };

    const record = {
        "ID": "60782",
        "family_name": "Segner",
        "given_name": "Johann",
        "mrauth_id": "158085",
        "other_names": "Andreas",
        "student_data": {
            "degrees": [
                {
                    "advised by": {
                        "125886": "Hamberger, Georg Erhard"
                    },
                    "degree_msc": "92",
                    "degree_type": "Medicinae Dr.",
                    "degree_year": "1726",
                    "schools": [
                        "Friedrich-Schiller-Universität Jena, Germany"
                    ],
                    "thesis_title": "Dissertationem chimicam penetrationem salis alcali in interstitia salis acidi per experimenta demonstrantem"
                },
                {
                    "advised by": {
                        "125971": "Hilscher, Simon Paul"
                    },
                    "degree_msc": "92",
                    "degree_type": "Medicinae Dr.",
                    "degree_year": "1734",
                    "schools": [
                        "Friedrich-Schiller-Universität Jena, Germany"
                    ],
                    "thesis_title": "Dissertatio inauguralis medica de principum militiam sequentium tuenda valetudine"
                },
                {
                    "advised by": {
                        "125886": "Hamberger, Georg Erhard"
                    },
                    "degree_msc": "26",
                    "degree_type": "D.Phil.",
                    "degree_year": "1725",
                    "schools": [
                        "Friedrich-Schiller-Universität Jena, Germany"
                    ],
                    "thesis_title": "Dissertatio epistolica qua regulam Harrioti de modo ex aequationum signis numerum radicum tam verarum quam spuriarum eas componentium, cognoscendi, demonstrare, simulque rationem structurae instrumenti novi, sectionibus conicis secundi generis plerisque, ac omnibus primi, describendis apti"
                },
                {
                    "advised by": {
                        "125971": "Hilscher, Simon Paul"
                    },
                    "degree_msc": "92",
                    "degree_type": "Medicinae Dr.",
                    "degree_year": "1730",
                    "schools": [
                        "Friedrich-Schiller-Universität Jena, Germany"
                    ],
                    "thesis_title": "De natura ac principiis medicinae"
                }
            ],
            "descendants": {
                "advisees": [
                    ["127668", "Büsch, Johann Georg"],
                    ["60815", "Niemeyer, August Hermann"],
                    ["60816", "Garve, Christian"],
                    ["60817", "Scheibel, Johann Ephraim"],
                ],
                "descendant_count": 142176
            }
        }
    };

    const studentNode = rdf.namedNode("http://mathgenealogy.org/id.php?id=60782");
    const advisor1Node = rdf.namedNode("http://mathgenealogy.org/id.php?id=125886");
    const advisor2Node = rdf.namedNode("http://mathgenealogy.org/id.php?id=125971");
    const refreshNode = rdf.namedNode(
        "http://diro.umontreal.ca/geniro/external/mathgenealogy.org"
        + "/refresh/60782"
    );
    const project1Node = rdf.namedNode(
        "http://diro.umontreal.ca/geniro/external/mathgenealogy.org"
        + "/project/60782-1726"
    );
    const time1Node = rdf.namedNode(
        "http://diro.umontreal.ca/geniro/external/mathgenealogy.org"
        + "/project/60782-1726#timePeriod"
    );
    const time1EndNode = rdf.namedNode(
        "http://diro.umontreal.ca/geniro/external/mathgenealogy.org"
        + "/project/60782-1726#timePeriod/end"
    );
    const project2Node = rdf.namedNode(
        "http://diro.umontreal.ca/geniro/external/mathgenealogy.org"
        + "/project/60782-1734"
    );
    const time2Node = rdf.namedNode(
        "http://diro.umontreal.ca/geniro/external/mathgenealogy.org"
        + "/project/60782-1734#timePeriod"
    );
    const time2EndNode = rdf.namedNode(
        "http://diro.umontreal.ca/geniro/external/mathgenealogy.org"
        + "/project/60782-1734#timePeriod/end"
    );
    const project3Node = rdf.namedNode(
        "http://diro.umontreal.ca/geniro/external/mathgenealogy.org"
        + "/project/60782-1725"
    );
    const time3Node = rdf.namedNode(
        "http://diro.umontreal.ca/geniro/external/mathgenealogy.org"
        + "/project/60782-1725#timePeriod"
    );
    const time3EndNode = rdf.namedNode(
        "http://diro.umontreal.ca/geniro/external/mathgenealogy.org"
        + "/project/60782-1725#timePeriod/end"
    );
    const project4Node = rdf.namedNode(
        "http://diro.umontreal.ca/geniro/external/mathgenealogy.org"
        + "/project/60782-1730"
    );
    const time4Node = rdf.namedNode(
        "http://diro.umontreal.ca/geniro/external/mathgenealogy.org"
        + "/project/60782-1730#timePeriod"
    );
    const time4EndNode = rdf.namedNode(
        "http://diro.umontreal.ca/geniro/external/mathgenealogy.org"
        + "/project/60782-1730#timePeriod/end"
    );
    const schoolNode = rdf.namedNode(
        "http://diro.umontreal.ca/geniro/external/mathgenealogy.org"
        + "/school/42"
    );

    const triples = Array.from(processRecord(record, schoolIds));
    assertEquals(triples.slice(0, 5).concat(triples.slice(6)), [
        [studentNode, rdfns.type, foaf.Person],
        [studentNode, foaf.firstName, rdf.literal("Johann")],
        [studentNode, foaf.lastName, rdf.literal("Segner")],
        [studentNode, owl.sameAs, rdf.namedNode("http://mathscinet.ams.org/mathscinet/author?authorId=158085")],
        [refreshNode, geniro.preferredUri, rdf.literal(studentNode.value)],

        [project1Node, geniro.student, studentNode],
        [project1Node, rdfns.type, geniro.PhDProject],
        [project1Node, dcterms.title, rdf.literal("Dissertationem chimicam penetrationem salis alcali in interstitia salis acidi per experimenta demonstrantem")],
        [project1Node, geniro.grantedBy, schoolNode],
        [schoolNode, rdfns.type, org.Organization],
        [schoolNode, skos.prefLabel, rdf.literal("Friedrich-Schiller-Universität Jena")],
        [project1Node, geniro.advisor, advisor1Node],
        [advisor1Node, rdfns.type, foaf.Person],
        [project1Node, geniro.timePeriod, time1Node],
        [time1Node, time.hasEnd, time1EndNode],
        [time1EndNode, time.inXSDDate, rdf.literal("1726-01-01", xsd.date)],

        [project2Node, geniro.student, studentNode],
        [project2Node, rdfns.type, geniro.PhDProject],
        [project2Node, dcterms.title, rdf.literal("Dissertatio inauguralis medica de principum militiam sequentium tuenda valetudine")],
        [project2Node, geniro.grantedBy, schoolNode],
        [schoolNode, rdfns.type, org.Organization],
        [schoolNode, skos.prefLabel, rdf.literal("Friedrich-Schiller-Universität Jena")],
        [project2Node, geniro.advisor, advisor2Node],
        [advisor2Node, rdfns.type, foaf.Person],
        [project2Node, geniro.timePeriod, time2Node],
        [time2Node, time.hasEnd, time2EndNode],
        [time2EndNode, time.inXSDDate, rdf.literal("1734-01-01", xsd.date)],

        [project3Node, geniro.student, studentNode],
        [project3Node, rdfns.type, geniro.PhDProject],
        [project3Node, dcterms.title, rdf.literal("Dissertatio epistolica qua regulam Harrioti de modo ex aequationum signis numerum radicum tam verarum quam spuriarum eas componentium, cognoscendi, demonstrare, simulque rationem structurae instrumenti novi, sectionibus conicis secundi generis plerisque, ac omnibus primi, describendis apti")],
        [project3Node, geniro.grantedBy, schoolNode],
        [schoolNode, rdfns.type, org.Organization],
        [schoolNode, skos.prefLabel, rdf.literal("Friedrich-Schiller-Universität Jena")],
        [project3Node, geniro.advisor, advisor1Node],
        [advisor1Node, rdfns.type, foaf.Person],
        [project3Node, geniro.timePeriod, time3Node],
        [time3Node, time.hasEnd, time3EndNode],
        [time3EndNode, time.inXSDDate, rdf.literal("1725-01-01", xsd.date)],

        [project4Node, geniro.student, studentNode],
        [project4Node, rdfns.type, geniro.PhDProject],
        [project4Node, dcterms.title, rdf.literal("De natura ac principiis medicinae")],
        [project4Node, geniro.grantedBy, schoolNode],
        [schoolNode, rdfns.type, org.Organization],
        [schoolNode, skos.prefLabel, rdf.literal("Friedrich-Schiller-Universität Jena")],
        [project4Node, geniro.advisor, advisor2Node],
        [advisor2Node, rdfns.type, foaf.Person],
        [project4Node, geniro.timePeriod, time4Node],
        [time4Node, time.hasEnd, time4EndNode],
        [time4EndNode, time.inXSDDate, rdf.literal("1730-01-01", xsd.date)],
    ]);
});

Deno.test("process record without a real degree", () => {
    const schoolIds = {};
    const record = {
        "ID": "143011",
        "family_name": "Malebranche",
        "given_name": "Nicolas",
        "mrauth_id": "493746",
        "other_names": "",
        "student_data": {
            "degrees": [
                {
                    "advised by": {
                        "60985": "Leibniz, Gottfried Wilhelm"
                    },
                    "degree_msc": "Unknown",
                    "degree_type": "no degree",
                    "degree_year": "Unknown",
                    "schools": [
                        ""
                    ],
                    "thesis_title": "We show a link to Leibniz to show a connection in our intellectual heritage."
                }
            ],
            "descendants": {
                "advisees": [
                    [
                        "112689",
                        "Varignon, Pierre"
                    ],
                    [
                        "54440",
                        "Bernoulli, Jacob"
                    ]
                ],
                "descendant_count": 173246
            }
        }
    };

    const studentNode = rdf.namedNode("http://mathgenealogy.org/id.php?id=143011");
    const advisorNode = rdf.namedNode("http://mathgenealogy.org/id.php?id=60985");
    const refreshNode = rdf.namedNode(
        "http://diro.umontreal.ca/geniro/external/mathgenealogy.org"
        + "/refresh/143011"
    );
    const projectNode = rdf.namedNode(
        "http://diro.umontreal.ca/geniro/external/mathgenealogy.org"
        + "/project/143011-unknown"
    );

    const triples = Array.from(processRecord(record, schoolIds));
    assertEquals(triples.slice(0, 5).concat(triples.slice(6)), [
        [studentNode, rdfns.type, foaf.Person],
        [studentNode, foaf.firstName, rdf.literal("Nicolas")],
        [studentNode, foaf.lastName, rdf.literal("Malebranche")],
        [studentNode, owl.sameAs, rdf.namedNode("http://mathscinet.ams.org/mathscinet/author?authorId=493746")],
        [refreshNode, geniro.preferredUri, rdf.literal(studentNode.value)],
        [projectNode, geniro.student, studentNode],
        [projectNode, rdfns.type, geniro.PhDProject],
        [projectNode, dcterms.title, rdf.literal("We show a link to Leibniz to show a connection in our intellectual heritage.")],
        [projectNode, geniro.advisor, advisorNode],
        [advisorNode, rdfns.type, foaf.Person],
    ]);
});
