// Formatação de data/hora usada em vários componentes (feed de notícias,
// indicador de saúde, status de keyword). Centralizado aqui para não
// reinstanciar o mesmo Intl.DateTimeFormat em cada arquivo.
const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

export function formatDateTime(date: Date): string {
  return dateTimeFormatter.format(date);
}
