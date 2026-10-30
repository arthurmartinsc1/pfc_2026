import type { Keyword, NewsItem, NewsKeywordMatch } from "@/generated/prisma/client";
import type { SearchJobSummary } from "@/types/search-job";

/**
 * MODO DE APRESENTAÇÃO — camada de exibição apenas.
 *
 * Quando os agentes não estão rodando (VM inacessível, SSH fora do ar), o
 * painel mostra a última coleta real e fica com o aviso vermelho de "sem
 * novas buscas há mais de 24h". Para gravar a apresentação, este módulo faz
 * a interface exibir uma coleta recente, com notícias fictícias plausíveis.
 *
 * REGRAS:
 * - Nada aqui é escrito no banco. O banco é o contrato com o agente
 *   (docs/CONTRATO.md) e continua intocado — tudo vive em memória, no
 *   processo do Next.js, e desaparece quando o servidor reinicia.
 * - As notícias reais que já estão no banco continuam lá; o modo de
 *   apresentação apenas as substitui na tela.
 * - Os assuntos (keywords) exibidos são os REAIS do banco, então os chips,
 *   o filtro por assunto e a tela de configurações seguem coerentes.
 *
 * PARA DESLIGAR (apresentação final com dados reais): troque a constante
 * abaixo para `false`. É o único interruptor — feed, gráficos, status da
 * coleta e status por assunto voltam todos para o banco.
 */
export const MODO_APRESENTACAO = true;

const PREFIXO_ID_DEMO = "demo-";

// Minutos atrás em que a "última execução dos agentes" terminou.
const ULTIMA_EXECUCAO_MIN = 12;

type Pauta = {
  titulo: string;
  fonte: string;
  resumo: string;
  url: string;
  // Assuntos (termo da keyword, sem acento) que casaram com a notícia.
  // Mais de um assunto é intencional em algumas pautas: o painel avisa que
  // uma notícia pode contar em mais de uma fatia do gráfico.
  assuntos: string[];
  // Quantas horas atrás a notícia foi coletada — define o dia em que ela
  // cai no gráfico de barras e a ordem do feed.
  horasAtras: number;
};

// Pautas plausíveis para os assuntos monitorados, escritas com os termos
// relacionados cadastrados ("drone", "mísseis", "foguetes", "Colômbia",
// "Guardião Cibernético") para que os chips de termo casado apareçam.
const PAUTAS: Pauta[] = [
  {
    titulo: "Ucrânia derruba 48 drones russos em ataque noturno a Kiev e Kharkiv",
    fonte: "CNN Brasil",
    resumo:
      "A Força Aérea ucraniana informou ter interceptado 48 dos 61 drones lançados durante a madrugada, no que descreveu como a maior ofensiva aérea das últimas três semanas. Os destroços atingiram uma subestação de energia em Kharkiv, deixando bairros inteiros sem eletricidade por cerca de quatro horas. Equipes de emergência trabalharam desde o amanhecer para restabelecer o fornecimento, concluído no início da tarde. Não houve registro de mortes, mas a prefeitura confirmou sete feridos, dois deles em estado grave.",
    url: "https://www.cnnbrasil.com.br/",
    assuntos: ["guerra na ucrania"],
    horasAtras: 0.4,
  },
  {
    titulo: "Rússia amplia produção de mísseis de cruzeiro, aponta relatório da OTAN",
    fonte: "G1",
    resumo:
      "Documento apresentado a representantes da aliança estima aumento de 40% na fabricação de mísseis de longo alcance em relação ao ano anterior. O relatório cita a reconversão de linhas industriais civis e a importação de componentes eletrônicos por intermediários em terceiros países. Analistas ouvidos pela reportagem avaliam que o ritmo atual permitiria sustentar ofensivas mensais ao longo de todo o inverno. A estimativa contraria projeções divulgadas no primeiro semestre, que apontavam esgotamento dos estoques.",
    url: "https://g1.globo.com/",
    assuntos: ["guerra na ucrania"],
    horasAtras: 1.2,
  },
  {
    titulo: "Exército Brasileiro conclui exercício Guardião Cibernético com 1.200 participantes",
    fonte: "Agência Brasil",
    resumo:
      "A edição deste ano do Guardião Cibernético simulou ataques coordenados a infraestruturas críticas de energia e telecomunicações ao longo de cinco dias. Participaram 38 instituições, entre órgãos públicos, forças armadas e empresas privadas dos setores elétrico e financeiro. Os cenários incluíram sequestro de dados em uma distribuidora fictícia e desinformação em redes sociais durante a crise. O relatório final, com as lições aprendidas, deve ser publicado em até 60 dias pelo Comando de Defesa Cibernética.",
    url: "https://agenciabrasil.ebc.com.br/",
    assuntos: ["defesa cibernetica"],
    horasAtras: 2.1,
  },
  {
    titulo: "Operação na fronteira com a Colômbia apreende 1,2 tonelada de entorpecentes",
    fonte: "Agência Brasil",
    resumo:
      "A ação conjunta entre Polícia Federal e Exército ocorreu na região do Alto Solimões, no Amazonas, e durou três dias. Segundo a PF, a carga seria levada por via fluvial até Manaus antes de seguir para portos do Nordeste com destino à Europa. Quatro pessoas foram detidas e duas embarcações apreendidas durante a abordagem. É a maior apreensão registrada na região neste ano, superando em 30% o total do mesmo período anterior.",
    url: "https://agenciabrasil.ebc.com.br/",
    assuntos: ["fronteira"],
    horasAtras: 3.5,
  },
  {
    titulo: "Ataque hacker a órgão federal expõe falha em sistema de autenticação",
    fonte: "Convergência Digital",
    resumo:
      "A invasão foi detectada pela equipe de resposta a incidentes após movimentação anômala em contas administrativas durante a madrugada. Não houve vazamento de dados de cidadãos, segundo nota oficial divulgada nesta manhã, mas o acesso permaneceu ativo por cerca de nove horas. A falha explorada estava em um módulo de autenticação de dois fatores que não havia recebido a atualização de segurança publicada em agosto. O órgão informou que todas as credenciais administrativas foram revogadas e substituídas.",
    url: "https://www.convergenciadigital.com.br/",
    assuntos: ["defesa cibernetica"],
    horasAtras: 5.0,
  },
  {
    titulo: "Rússia atinge região de fronteira entre Ucrânia e Polônia, diz Kiev",
    fonte: "CNN Brasil",
    resumo:
      "Foguetes lançados contra um entroncamento ferroviário caíram a menos de 20 km do território polonês, segundo o comando militar ucraniano. Varsóvia acionou caças de patrulha e convocou reunião de emergência do conselho de segurança nacional ainda na manhã desta quarta. O entroncamento é uma das principais rotas de entrada de ajuda humanitária e material militar no país. O governo polonês afirmou que não houve violação de seu espaço aéreo, mas classificou o episódio como provocação deliberada.",
    url: "https://www.cnnbrasil.com.br/",
    assuntos: ["guerra na ucrania", "fronteira"],
    horasAtras: 6.8,
  },
  {
    titulo: "Ministério da Defesa anuncia centro de operações cibernéticas em Brasília",
    fonte: "www.gov.br",
    resumo:
      "A estrutura vai concentrar o monitoramento de redes das três forças em um único centro de comando, com operação 24 horas. O investimento previsto é de R$ 180 milhões em três anos, com operação plena estimada para 2028. O projeto inclui a contratação de 240 analistas e a criação de uma reserva técnica de especialistas civis convocáveis em crises. Segundo o ministério, o centro também vai atender demandas de órgãos civis responsáveis por infraestrutura crítica.",
    url: "https://www.gov.br/defesa/",
    assuntos: ["defesa cibernetica"],
    horasAtras: 9.3,
  },
  {
    titulo: "Ucrânia recebe primeiro lote de sistemas antiaéreos de médio alcance",
    fonte: "BBC News Brasil",
    resumo:
      "O envio faz parte de um pacote aprovado em julho e deve reforçar a defesa de usinas termoelétricas antes do inverno. Autoridades não informaram a quantidade de baterias entregues por razões de segurança operacional. O treinamento das equipes ucranianas começou há dois meses em bases na Alemanha e na Romênia. Um segundo lote, com munição e peças de reposição, está previsto para as próximas seis semanas.",
    url: "https://www.bbc.com/portuguese",
    assuntos: ["guerra na ucrania"],
    horasAtras: 26.4,
  },
  {
    titulo: "Receita Federal reforça fiscalização na fronteira com o Paraguai",
    fonte: "Folha de S.Paulo",
    resumo:
      "Novos escâneres de carga entram em operação em Foz do Iguaçu e Ponta Porã a partir da próxima segunda-feira. A medida busca reduzir o contrabando de eletrônicos, que cresceu 18% no último levantamento do órgão. Cada equipamento inspeciona um caminhão em menos de três minutos, sem necessidade de descarregamento. A Receita estima que o tempo médio de espera na travessia caia pela metade mesmo com a fiscalização mais rigorosa.",
    url: "https://www1.folha.uol.com.br/",
    assuntos: ["fronteira"],
    horasAtras: 28.1,
  },
  {
    titulo: "Drones de reconhecimento passam a monitorar 400 km da faixa de fronteira",
    fonte: "R7",
    resumo:
      "O programa começa pelo Mato Grosso do Sul e deve se estender ao Acre no próximo semestre, segundo o Ministério da Justiça. Cada aeronave cobre um raio de 150 km e transmite imagens em tempo real para centros regionais de comando. As imagens serão cruzadas com dados de radar e de informantes para identificar pistas de pouso clandestinas. A operação será conduzida em conjunto com a Força Aérea, que cede pilotos remotos e infraestrutura de comunicação.",
    url: "https://noticias.r7.com/",
    assuntos: ["fronteira", "guerra na ucrania"],
    horasAtras: 30.6,
  },
  {
    titulo: "Especialistas alertam para ataques de ransomware a hospitais públicos",
    fonte: "UOL Notícias",
    resumo:
      "Levantamento aponta 73 tentativas de invasão a redes hospitalares no primeiro semestre, quase o dobro do registrado no ano anterior. Em metade dos casos, o vetor inicial foi uma credencial reutilizada de funcionário terceirizado. Três hospitais de médio porte precisaram suspender agendamentos eletivos por até uma semana para restaurar sistemas. O estudo recomenda segmentação de rede e backups offline como as duas medidas de maior efeito imediato.",
    url: "https://noticias.uol.com.br/",
    assuntos: ["defesa cibernetica"],
    horasAtras: 33.2,
  },
  {
    titulo: "Negociações de cessar-fogo na Ucrânia avançam em pauta energética",
    fonte: "Estadão",
    resumo:
      "Delegações concordaram em discutir a suspensão de ataques a usinas e refinarias como primeiro passo de um acordo mais amplo. O tema das fronteiras territoriais segue fora da mesa, segundo dois diplomatas ouvidos pela reportagem. A proposta prevê um período inicial de 30 dias, com verificação por observadores de um país neutro. Nenhuma das partes confirmou publicamente a adesão, e uma nova rodada está marcada para o fim do mês.",
    url: "https://www.estadao.com.br/",
    assuntos: ["guerra na ucrania"],
    horasAtras: 50.5,
  },
  {
    titulo: "Rússia e Ucrânia trocam 180 prisioneiros de guerra em mediação turca",
    fonte: "G1",
    resumo:
      "A troca foi intermediada pela Turquia e aconteceu na fronteira com Belarus, sob supervisão de representantes da Cruz Vermelha. É a maior desde março, e ambos os lados sinalizaram disposição para uma nova rodada ainda neste mês. Entre os libertados há 24 militares feridos que receberam atendimento médico imediato. As famílias foram informadas com apenas algumas horas de antecedência, por questões de segurança.",
    url: "https://g1.globo.com/",
    assuntos: ["guerra na ucrania"],
    horasAtras: 53.7,
  },
  {
    titulo: "Tribunal de Contas aponta atraso em plano nacional de defesa cibernética",
    fonte: "Convergência Digital",
    resumo:
      "Auditoria identificou que 11 das 23 metas previstas para o período não saíram do papel, entre elas a criação de um cadastro nacional de incidentes. O relatório recomenda prazo de 90 dias para apresentação de cronograma revisado, com responsáveis nomeados por meta. Os auditores também apontaram que apenas 38% do orçamento autorizado foi efetivamente executado. O ministério respondeu que a execução foi afetada por atrasos em licitações de equipamentos importados.",
    url: "https://www.convergenciadigital.com.br/",
    assuntos: ["defesa cibernetica"],
    horasAtras: 56.9,
  },
  {
    titulo: "Mísseis atingem porto de Odessa e interrompem embarque de grãos",
    fonte: "BBC News Brasil",
    resumo:
      "Três navios cargueiros foram danificados e a exportação ficou suspensa por 36 horas, segundo a autoridade portuária. O corredor marítimo responde por cerca de 60% do escoamento agrícola ucraniano e movimenta trigo e milho para a Ásia e o norte da África. Dois trabalhadores portuários ficaram feridos durante o ataque, que ocorreu no fim da tarde. Os embarques foram retomados em ritmo reduzido, com parte da carga redirecionada para portos do Danúbio.",
    url: "https://www.bbc.com/portuguese",
    assuntos: ["guerra na ucrania"],
    horasAtras: 74.2,
  },
  {
    titulo: "Colômbia e Brasil criam força-tarefa conjunta para a fronteira amazônica",
    fonte: "Folha de S.Paulo",
    resumo:
      "O acordo prevê patrulhas coordenadas e troca de inteligência sobre rotas de garimpo ilegal e tráfico de armas. A primeira operação conjunta está prevista para o próximo trimestre, na região de Tabatinga. Cada país manterá um oficial de ligação permanente na base do outro, para encurtar o tempo de resposta a denúncias. O entendimento foi assinado durante encontro de ministros da Defesa dos dois países em Bogotá.",
    url: "https://www1.folha.uol.com.br/",
    assuntos: ["fronteira"],
    horasAtras: 77.8,
  },
  {
    titulo: "Apagão em subestação ucraniana deixa 200 mil sem energia após ataque",
    fonte: "CNN Brasil",
    resumo:
      "A queda ocorreu depois de um ataque com drones na região de Dnipro, que atingiu dois transformadores de alta tensão. Equipes trabalharam por 14 horas para restabelecer o fornecimento em caráter emergencial, com geradores móveis. Hospitais e estações de tratamento de água foram priorizados na religação. A operadora nacional alertou que novos cortes programados são prováveis enquanto os reparos definitivos não forem concluídos.",
    url: "https://www.cnnbrasil.com.br/",
    assuntos: ["guerra na ucrania"],
    horasAtras: 98.3,
  },
  {
    titulo: "Curso de resposta a incidentes forma 300 analistas em segurança pública",
    fonte: "www.gov.br",
    resumo:
      "A formação reuniu profissionais de 14 estados e abordou contenção de incidentes em redes de infraestrutura crítica. A próxima turma abre inscrições em novembro, com 400 vagas e módulos à distância. O conteúdo foi desenvolvido em parceria com universidades federais e inclui exercícios práticos em ambiente simulado. Segundo os organizadores, a meta é formar 2 mil analistas até o fim de 2028.",
    url: "https://www.gov.br/defesa/",
    assuntos: ["defesa cibernetica"],
    horasAtras: 101.5,
  },
];

// Notícias descartadas durante a apresentação. Vive só em memória, no
// processo do servidor: o botão "Descartar" funciona de verdade na tela sem
// escrever nada no banco, e tudo volta ao normal ao reiniciar o servidor.
const descartadasNaSessao = new Set<string>();

export function ehIdDemo(id: string) {
  return id.startsWith(PREFIXO_ID_DEMO);
}

export function descartarNoDemo(id: string) {
  descartadasNaSessao.add(id);
}

function semAcento(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export type NoticiaDemo = NewsItem & {
  matches: (NewsKeywordMatch & { keyword: Keyword })[];
};

/**
 * Monta as notícias da apresentação a partir dos assuntos REAIS do banco.
 * Uma pauta cujo assunto não existe mais (assunto renomeado ou excluído)
 * ainda aparece no feed, só sem o chip daquele assunto.
 */
export function noticiasDemo(keywords: Keyword[]): NoticiaDemo[] {
  const agora = Date.now();
  const porTermo = new Map(keywords.map((k) => [semAcento(k.termo), k]));

  return PAUTAS.map((pauta, i): NoticiaDemo => {
    const id = `${PREFIXO_ID_DEMO}${String(i + 1).padStart(2, "0")}`;
    const fetchedAt = new Date(agora - pauta.horasAtras * 60 * 60 * 1000);
    const encontrados = pauta.assuntos
      .map((assunto) => porTermo.get(semAcento(assunto)))
      .filter((keyword): keyword is Keyword => Boolean(keyword));

    return {
      id,
      titulo: pauta.titulo,
      url: pauta.url,
      fonte: pauta.fonte,
      resumo: pauta.resumo,
      relevancia: null,
      dataPublicacaoOriginal: fetchedAt,
      fetchedAt,
      descartada: false,
      matches: encontrados.map((keyword, j) => ({
        id: `${id}-m${j}`,
        newsItemId: id,
        keywordId: keyword.id,
        jobId: `${id}-j${j}`,
        createdAt: fetchedAt,
        keyword,
      })),
    };
  }).filter((noticia) => !descartadasNaSessao.has(noticia.id));
}

export type FiltrosDemo = {
  keywordId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
};

// Replica em memória os mesmos filtros que a consulta real aplica no banco
// (assunto, texto no título/resumo, intervalo de datas), para que a tela de
// filtros continue funcionando na apresentação.
export function filtrarNoticiasDemo(noticias: NoticiaDemo[], filtros: FiltrosDemo) {
  const busca = filtros.search?.trim() ? semAcento(filtros.search.trim()) : null;
  const de = filtros.dateFrom ? new Date(`${filtros.dateFrom}T00:00:00`) : null;
  const ate = filtros.dateTo ? new Date(`${filtros.dateTo}T23:59:59.999`) : null;

  return noticias
    .filter((noticia) => {
      if (filtros.keywordId && !noticia.matches.some((m) => m.keywordId === filtros.keywordId)) {
        return false;
      }
      if (busca && !semAcento(`${noticia.titulo} ${noticia.resumo}`).includes(busca)) {
        return false;
      }
      if (de && noticia.fetchedAt < de) return false;
      if (ate && noticia.fetchedAt > ate) return false;
      return true;
    })
    .sort((a, b) => b.fetchedAt.getTime() - a.fetchedAt.getTime());
}

// Distribuição por assunto, na mesma forma da consulta real: uma notícia que
// casa com N assuntos conta uma vez em cada.
export function distribuicaoDemo(noticias: NoticiaDemo[]) {
  const totais = new Map<string, { id: string; termo: string; total: number }>();
  for (const noticia of noticias) {
    for (const { keyword } of noticia.matches) {
      const atual = totais.get(keyword.id);
      if (atual) atual.total += 1;
      else totais.set(keyword.id, { id: keyword.id, termo: keyword.termo, total: 1 });
    }
  }
  return {
    perKeyword: Array.from(totais.values()).sort(
      (a, b) => b.total - a.total || a.termo.localeCompare(b.termo)
    ),
    totalNews: noticias.length,
  };
}

// Notícias por dia, no formato da consulta real (YYYY-MM-DD no fuso local).
// Dias sem notícia continuam fora da lista — quem preenche a janela é o
// próprio gráfico.
export function porDiaDemo(noticias: NoticiaDemo[]) {
  const totais = new Map<string, number>();
  for (const noticia of noticias) {
    const d = noticia.fetchedAt;
    const dia = [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, "0"),
      String(d.getDate()).padStart(2, "0"),
    ].join("-");
    totais.set(dia, (totais.get(dia) ?? 0) + 1);
  }
  return Array.from(totais.entries())
    .map(([dia, total]) => ({ dia, total }))
    .sort((a, b) => a.dia.localeCompare(b.dia));
}

function ultimaExecucao() {
  return new Date(Date.now() - ULTIMA_EXECUCAO_MIN * 60 * 1000);
}

// Status da coleta: uma execução concluída há poucos minutos, para o painel
// mostrar "Última atualização" em verde em vez do alerta de coleta parada.
export function saudeDemo() {
  const finishedAt = ultimaExecucao();
  return { lastFinishedAt: finishedAt, hasAnyJob: true, isStale: false };
}

// Última execução por assunto na tela de configurações — escalonada para não
// parecer que as três buscas terminaram no mesmo segundo.
export function jobConcluidoDemo(indice: number): SearchJobSummary {
  const finishedAt = new Date(ultimaExecucao().getTime() - indice * 7 * 60 * 1000);
  return {
    status: "concluido",
    origem: "agendado",
    startedAt: new Date(finishedAt.getTime() - 3 * 60 * 1000),
    finishedAt,
    erroMsg: null,
    createdAt: new Date(finishedAt.getTime() - 4 * 60 * 1000),
  };
}
