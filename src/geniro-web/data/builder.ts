export * from "rdf-sparql-builder";

import Aggregate from "rdf-sparql-builder/lib/Aggregate.js";
import Node from "rdf-sparql-builder/lib/Node.js";
import SubQuery from "rdf-sparql-builder/lib/SubQuery.js";
import smartAddPatterns from "rdf-sparql-builder/lib/utils/smartAddPatterns.js";

// To allow for typing functions expecting a query object
export { Node };

// Waiting on <https://github.com/rdf-ext/rdf-sparql-builder/issues/41>
export const sample = (variable, as) => new Aggregate("SAMPLE", variable, as);
export const groupConcat = (variable, as) => new Aggregate("GROUP_CONCAT", variable, as);

class SubQueryFunc extends Node {
    constructor(name, patterns) {
        super({ type: "SubQueryFunc" });

        this.attr.name = name;
        this.attr.subquery = new SubQuery();
        smartAddPatterns(this.attr.subquery, patterns);
    }

    toString() {
        return `${this.attr.name} ${this.attr.subquery}`;
    }
}

export const exists = (patterns) => new SubQueryFunc("EXISTS", patterns);
export const notExists = (patterns) => new SubQueryFunc("NOT EXISTS", patterns);
