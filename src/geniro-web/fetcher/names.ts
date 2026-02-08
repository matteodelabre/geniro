import unidecode from "unidecode";

const specialChars = /[^a-zA-Z0-9]+/;

export const normalize = (name: string) => {
    if (name.indexOf(",") !== -1) {
        name = name.split(",").reverse().join(" ");
    }

    name = unidecode(name).toLowerCase().trim();
    return name.split(specialChars).join("-");
};

const splitSpaces = (value: string) => value.trim().split(/\s+/g);
const startsLowercase = (value: string) => value[0].toLowerCase() === value[0];

export const decompose = (name: string) => {
    if (name.indexOf(",") !== -1) {
        const separator = name.indexOf(",");
        return [
            splitSpaces(name.substring(separator + 1)).join(" "),
            splitSpaces(name.substring(0, separator)).join(" "),
        ];
    }

    const parts = splitSpaces(name);

    if (parts.length === 0) {
        return ["", ""];
    }

    let lastNameStart = parts.length - 1;

    while (lastNameStart > 0 && startsLowercase(parts[lastNameStart - 1])) {
        lastNameStart -= 1;
    }

    return [
        parts.slice(0, lastNameStart).join(" "),
        parts.slice(lastNameStart).join(" "),
    ];
};
