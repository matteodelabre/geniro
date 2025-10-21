import unidecode from "unidecode";

const specialChars = /[^a-zA-Z0-9]+/;

export const normalize = (name: string) => {
    if (name.indexOf(",") !== -1) {
        name = name.split(",").reverse().join(" ");
    }

    name = unidecode(name).toLowerCase().trim();
    return name.split(specialChars).join("-");
};

export const decompose = (name: string) => {
    if (name.indexOf(",") !== -1) {
        const separator = name.indexOf(",");
        return [
            name.substring(separator + 1).trim(),
            name.substring(0, separator).trim(),
        ];
    }

    if (name.lastIndexOf(" ") !== -1) {
        const separator = name.lastIndexOf(" ");
        return [
            name.substring(0, separator).trim(),
            name.substring(separator + 1).trim(),
        ];
    }

    return [name, ""];
};
