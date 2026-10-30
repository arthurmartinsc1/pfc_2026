// Tema claro/escuro. A escolha do usuário fica em localStorage (nada vai
// para o banco — o banco é contrato com o agente, ver docs/CONTRATO.md) e é
// aplicada como `data-theme` no <html>, de onde o CSS em globals.css lê os
// tokens de cor.
//
// Sem escolha salva, seguimos o sistema operacional; o padrão de fábrica,
// quando nem isso existe, é o escuro (identidade "sala de situação").

export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "pfc:tema";

// Script injetado no <head> e executado antes do primeiro paint — sem isso a
// página pintaria no escuro e saltaria para o claro depois da hidratação.
// Mantido como string porque precisa rodar síncrono, fora do bundle do React.
export const THEME_INIT_SCRIPT = `
(function () {
  try {
    var salvo = localStorage.getItem("${THEME_STORAGE_KEY}");
    var tema =
      salvo === "light" || salvo === "dark"
        ? salvo
        : window.matchMedia("(prefers-color-scheme: light)").matches
          ? "light"
          : "dark";
    document.documentElement.dataset.theme = tema;
  } catch (e) {
    /* localStorage bloqueado (modo privado): fica no padrão do CSS. */
  }
})();
`;
