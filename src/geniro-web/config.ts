/** Root URL to access the hosted website. */
export const webRoot = "http://localhost:8765";

/** Port through which the server should be exposed. */
export const listenPort = 8765;

/** URL for the triple store endpoint. */
export const databaseEndpoint = "http://localhost:7200/repositories/geniro";

/** Namespace for RDF triples in the database. */
export const mainRdfNamespace = "http://diro.umontreal.ca/geniro";

/** Contact name and email sent to servers to identify the data requests. */
export const adminName = "Mattéo Delabre";
export const adminEmail = "geniro.matteo@delab.re";

/** Minimum delay between two data requests per domain, in milliseconds. */
export const minRequestDelay = 2500;

/** Maximum number of attempts for a data request before giving up. */
export const maxRequestAttempts = 3;
