import { mainRdfNamespace, webRoot } from "../config.ts";

export const uriToUrl = (uri) => {
    let url = uri;

    if (uri.startsWith(mainRdfNamespace)) {
        const stem = uri.slice(mainRdfNamespace.length);
        url = webRoot + stem;
    }

    return url;
};

export const dateShowYear = (value) => new Date(value).getUTCFullYear();

export const renderTable = (data, fields) => {
    const keys = Object.keys(fields);
    const id = (value) => value;

    return (
        <table>
            <thead>
                <tr>{keys.map((key) => <th>{fields[key].label}</th>)}</tr>
            </thead>
            {data.length > 0
                ? data.map((row) => (
                    <tr>
                        {keys.map((key) => (
                            <td>{(fields[key].display || id)(row[key], row)}</td>
                        ))}
                    </tr>
                ))
                : (
                    <tr>
                        <td colspan={keys.length} class="nodata">
                            Aucune information
                        </td>
                    </tr>
                )}
        </table>
    );
};
