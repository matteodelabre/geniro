import { assertEquals } from "@std/assert";
import * as names from "./names.ts";

Deno.test("normalize names", () => {
    assertEquals(names.normalize("Mattéo Delabre"), "matteo-delabre");
    assertEquals(names.normalize("Delabre, Mattéo"), "matteo-delabre");
    assertEquals(names.normalize("Smith, John S."), "john-s-smith");
    assertEquals(names.normalize("夏目 漱石"), "xia-mu-shu-shi");
});

Deno.test("decompose names", () => {
    assertEquals(names.decompose("Mattéo Delabre"), ["Mattéo", "Delabre"]);
    assertEquals(names.decompose("Delabre, Mattéo"), ["Mattéo", "Delabre"]);
    assertEquals(names.decompose("John S. Smith"), ["John S.", "Smith"]);
    assertEquals(names.decompose("Smith, John S."), ["John S.", "Smith"]);
});
