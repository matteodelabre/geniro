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
                <identifier>oai:umontreal.scholaris.ca:1866/4316</identifier>
                <datestamp>2025-11-08T06:26:21Z</datestamp>
                <setSpec>com_1866_2958</setSpec>
                <setSpec>com_1866_3010</setSpec>
                <setSpec>col_1866_3001</setSpec>
            </header>
            <metadata>
                <thesis xmlns="http://www.ndltd.org/standards/metadata/etdms/1.1/"
                        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                        xmlns:dc="http://purl.org/dc/elements/1.1/"
                        xmlns:dcterms="http://purl.org/dc/terms/"
                        xmlns:doc="http://www.lyncode.com/xoai">
                    <title>Échantillonnage dynamique de champs markoviens</title>
                    <creator resource="https://orcid.org/0000-0003-2823-504X">Breuleux, Olivier</creator>
                    <subject>Apprentissage machine</subject>
                    <subject>Champs markoviens</subject>
                    <subject>Machine de Boltzmann</subject>
                    <subject>MCMC</subject>
                    <subject>Modèles probabilistes</subject>
                    <subject>Machine learning</subject>
                    <subject>Markov random fields</subject>
                    <subject>Boltzmann machine</subject>
                    <subject>MCMC</subject>
                    <subject>Probabilistic models</subject>
                    <dc:description role="abstract">L&amp;apos;un des modèles d&amp;apos;apprentissage non-supervisé générant le plus de recherche active est la machine de Boltzmann --- en particulier la machine de Boltzmann restreinte, ou RBM. Un aspect important de l&amp;apos;entraînement ainsi que l&amp;apos;exploitation d&amp;apos;un tel modèle est la prise d&amp;apos;échantillons. Deux développements récents, la divergence contrastive persistante rapide (FPCD) et le herding, visent à améliorer cet aspect, se concentrant principalement sur le processus d&amp;apos;apprentissage en tant que tel. Notamment, le herding renonce à obtenir un estimé précis des paramètres de la RBM, définissant plutôt une distribution par un système dynamique guidé par les exemples d&amp;apos;entraînement. Nous généralisons ces idées afin d&amp;apos;obtenir des algorithmes permettant d&amp;apos;exploiter la distribution de probabilités définie par une RBM pré-entraînée, par tirage d&amp;apos;échantillons qui en sont représentatifs, et ce sans que l&amp;apos;ensemble d&amp;apos;entraînement ne soit nécessaire. Nous présentons trois méthodes: la pénalisation d&amp;apos;échantillon (basée sur une intuition théorique) ainsi que la FPCD et le herding utilisant des statistiques constantes pour la phase positive. Ces méthodes définissent des systèmes dynamiques produisant des échantillons ayant les statistiques voulues et nous les évaluons à l&amp;apos;aide d&amp;apos;une méthode d&amp;apos;estimation de densité non-paramétrique. Nous montrons que ces méthodes mixent substantiellement mieux que la méthode conventionnelle, l&amp;apos;échantillonnage de Gibbs.</dc:description>
                    <dc:description role="abstract">One of the most active topics of research in unsupervised learning is the Boltzmann machine --- particularly the Restricted Boltzmann Machine or RBM. In order to train, evaluate or exploit such models, one has to draw samples from it. Two recent algorithms, Fast Persistent Contrastive Divergence (FPCD) and Herding aim to improve sampling during training. In particular, herding gives up on obtaining a point estimate of the RBM&amp;apos;s parameters, rather defining the model&amp;apos;s distribution with a dynamical system guided by training samples. We generalize these ideas in order to obtain algorithms capable of exploiting the probability distribution defined by a pre-trained RBM, by sampling from it, without needing to make use of the training set. We present three methods: Sample Penalization, based on a theoretical argument as well as FPCD and Herding using constant statistics for their positive phases. These methods define dynamical systems producing samples with the right statistics and we evaluate them using non-parametric density estimation. We show that these methods mix substantially better than Gibbs sampling, which is the conventional sampling method used for RBMs.</dc:description>
                    <publisher country="Canada">Université de Montréal</publisher>
                    <contributor role="directeur(trice) de recherche/advisor">Bengio, Yoshua</contributor>
                    <contributor role="directeur(trice) de recherche/advisor">Tabar, Sofiene</contributor>
                    <date>2009</date>
                    <type xml:lang="fr">Thèse ou mémoire numérique</type>
                    <type xml:lang="en">Electronic Thesis or Dissertation</type>
                    <identifier>http://hdl.handle.net/1866/4316</identifier>
                    <identifier>https://doi.org/10.71781/9635</identifier>
                    <identifier>https://umontreal.scholaris.ca/bitstreams/e9844659-33c2-43e7-a517-aa5d4cd88dde/download</identifier>
                    <format>application/pdf</format>
                    <language xsi:type="dcterms:ISO639-3">fra</language>
                    <rights>© Olivier Breuleux, 2009</rights>
                    <degree>
                        <name>M. Sc.</name>
                        <level xml:lang="fr">Maîtrise</level>
                        <level xml:lang="en">Master&amp;apos;s</level>
                        <discipline xml:lang="fr">Informatique</discipline>
                        <grantor xml:lang="fr">Université de Montréal</grantor>
                    </degree>
                </thesis>
            </metadata>
        </record>
    `);

    const origin = "example.org";
    const grantor = rdf.namedNode("http://example.org/org/example");
    const project = rdf.namedNode("oai:umontreal.scholaris.ca:1866/4316");
    const student = rdf.namedNode(
        "http://diro.umontreal.ca/geniro/external/example.org/person/olivier-breuleux",
    );
    const advisor1 = rdf.namedNode(
        "http://diro.umontreal.ca/geniro/external/example.org/person/yoshua-bengio",
    );
    const advisor2 = rdf.namedNode(
        "http://diro.umontreal.ca/geniro/external/example.org/person/sofiene-tabar",
    );
    const timeNode = rdf.namedNode(project.value + "#timePeriod");
    const timeEndNode = rdf.namedNode(timeNode.value + "/end");

    const triples = Array.from(processRecord(record, origin, grantor));
    assertEquals(triples, [
        [project, geniro.grantedBy, grantor],
        [project, rdfns.type, geniro.MScProject],
        [project, dcterms.title, rdf.literal("Échantillonnage dynamique de champs markoviens")],
        [project, dcterms.description, rdf.literal("L'un des modèles d'apprentissage non-supervisé générant le plus de recherche active est la machine de Boltzmann --- en particulier la machine de Boltzmann restreinte, ou RBM. Un aspect important de l'entraînement ainsi que l'exploitation d'un tel modèle est la prise d'échantillons. Deux développements récents, la divergence contrastive persistante rapide (FPCD) et le herding, visent à améliorer cet aspect, se concentrant principalement sur le processus d'apprentissage en tant que tel. Notamment, le herding renonce à obtenir un estimé précis des paramètres de la RBM, définissant plutôt une distribution par un système dynamique guidé par les exemples d'entraînement. Nous généralisons ces idées afin d'obtenir des algorithmes permettant d'exploiter la distribution de probabilités définie par une RBM pré-entraînée, par tirage d'échantillons qui en sont représentatifs, et ce sans que l'ensemble d'entraînement ne soit nécessaire. Nous présentons trois méthodes: la pénalisation d'échantillon (basée sur une intuition théorique) ainsi que la FPCD et le herding utilisant des statistiques constantes pour la phase positive. Ces méthodes définissent des systèmes dynamiques produisant des échantillons ayant les statistiques voulues et nous les évaluons à l'aide d'une méthode d'estimation de densité non-paramétrique. Nous montrons que ces méthodes mixent substantiellement mieux que la méthode conventionnelle, l'échantillonnage de Gibbs.", "fr")],
        [project, dcterms.description, rdf.literal("One of the most active topics of research in unsupervised learning is the Boltzmann machine --- particularly the Restricted Boltzmann Machine or RBM. In order to train, evaluate or exploit such models, one has to draw samples from it. Two recent algorithms, Fast Persistent Contrastive Divergence (FPCD) and Herding aim to improve sampling during training. In particular, herding gives up on obtaining a point estimate of the RBM's parameters, rather defining the model's distribution with a dynamical system guided by training samples. We generalize these ideas in order to obtain algorithms capable of exploiting the probability distribution defined by a pre-trained RBM, by sampling from it, without needing to make use of the training set. We present three methods: Sample Penalization, based on a theoretical argument as well as FPCD and Herding using constant statistics for their positive phases. These methods define dynamical systems producing samples with the right statistics and we evaluate them using non-parametric density estimation. We show that these methods mix substantially better than Gibbs sampling, which is the conventional sampling method used for RBMs.", "en")],
        [project, geniro.timePeriod, timeNode],
        [timeNode, time.hasEnd, timeEndNode],
        [timeEndNode, time.inXSDDate, rdf.literal("2009-01-01", xsd.date)],
        [student, rdfns.type, foaf.Person],
        [project, geniro.student, student],
        [student, foaf.firstName, rdf.literal("Olivier")],
        [student, foaf.lastName, rdf.literal("Breuleux")],
        [
            student,
            owl.sameAs,
            rdf.namedNode("https://orcid.org/0000-0003-2823-504X"),
        ],
        [advisor1, rdfns.type, foaf.Person],
        [project, geniro.advisor, advisor1],
        [advisor1, foaf.firstName, rdf.literal("Yoshua")],
        [advisor1, foaf.lastName, rdf.literal("Bengio")],
        [advisor2, rdfns.type, foaf.Person],
        [project, geniro.advisor, advisor2],
        [advisor2, foaf.firstName, rdf.literal("Sofiene")],
        [advisor2, foaf.lastName, rdf.literal("Tabar")],
        [project, geniro.thesis, rdf.namedNode("https://hdl.handle.net/1866/4316")],
    ]);
});
