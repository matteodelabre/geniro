import { NamedNode } from "@rdfjs/data-model";

type Namespace = (term: string) => NamedNode;
type ClosedNamespace = { [key: string]: NamedNode };

export const makeClosedNamespace = (
    base: Namespace,
    keys: Array<string>,
): ClosedNamespace => (
    keys.reduce(
        (obj, key) => {
            obj[key] = base(key);
            return obj;
        },
        { $: base } as ClosedNamespace,
    )
);
