export * from "rdf-sparql-builder";

import Aggregate from "rdf-sparql-builder/lib/Aggregate.js";
import Node from "rdf-sparql-builder/lib/Node.js";
import SubQuery from "rdf-sparql-builder/lib/SubQuery.js";
import Patterns from "rdf-sparql-builder/lib/Patterns.js";
import Where from "rdf-sparql-builder/lib/Where.js";
import Filters from "rdf-sparql-builder/lib/Filters.js";
import smartAddPatterns from "rdf-sparql-builder/lib/utils/smartAddPatterns.js";

// To allow for typing functions expecting a query object
export { Node };

// Waiting on <https://github.com/rdf-ext/rdf-sparql-builder/issues/41>
export const sample = (variable, as) => new Aggregate("SAMPLE", variable, as);
export const groupConcat = (variable, as) => new Aggregate("GROUP_CONCAT", variable, as);

// Add support for `exists` and `not exists` boolean functions
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

// Add support for mixed insert and delete clauses
class DeleteInsert extends Node {
    constructor({ queryPrefix } = {}) {
        super({ type: "DeleteInsert" });
        this.attr = { queryPrefix };
        this.children = [
            new SubQuery(new Patterns()),
            new SubQuery(new Patterns()),
            new Where(),
        ];
    }

    get _delete() {
        return this.children[0].children[0];
    }

    get _insert() {
        return this.children[1].children[0];
    }

    get _where() {
        return this.children[2];
    }

    delete(patterns) {
        return this.clone((clone) => {
            smartAddPatterns(clone._delete, patterns);
        });
    }

    insert(patterns) {
        return this.clone((clone) => {
            smartAddPatterns(clone._insert, patterns);
        });
    }

    where(patterns) {
        return this.clone((clone) => {
            smartAddPatterns(clone._where, patterns);
        });
    }

    filter(filters) {
        return this.clone((clone) => {
            if (Array.isArray(filters)) {
                return clone._where.add(new Filters(filters));
            }

            clone._where.add(filters);
        });
    }

    toString() {
        const parts = [];

        if (this._delete.children.length !== 0) {
            parts.push("DELETE {", this._delete.toString(), "}");
        }

        if (this._insert.children.length !== 0) {
            parts.push("INSERT {", this._insert.toString(), "}");
        }

        parts.push(this._where.toString());
        return parts.join("\n");
    }
}

export const insert = (patterns) => new DeleteInsert().insert(patterns);
const deleteQuery = (patterns) => new DeleteInsert().delete(patterns);
export { deleteQuery as delete };
