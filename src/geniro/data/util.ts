import { NamedNode } from "@rdfjs/data-model";

type Namespace = (term: string) => NamedNode;
type ClosedNamespace = { [key: string]: NamedNode };

const closedNamespaceHandler = {
    get(target, prop, _) {
        if (prop in target) {
            return target[prop];
        }

        throw new ReferenceError(
            `namespace <${target.$().value}> has no property '${prop}'`,
        );
    },
};

export const makeClosedNamespace = (
    base: Namespace,
    keys: Array<string>,
): ClosedNamespace =>
    new Proxy(
        keys.reduce(
            (obj, key) => {
                obj[key] = base(key);
                return obj;
            },
            { $: base },
        ),
        closedNamespaceHandler,
    ) as ClosedNamespace;
