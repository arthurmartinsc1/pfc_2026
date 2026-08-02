import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

function hoursAgo(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

function minutesAgo(minutes: number) {
  return new Date(Date.now() - minutes * 60 * 1000);
}

function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

async function main() {
  // Ordem de limpeza respeita as FKs (matches -> jobs/news -> keywords).
  await prisma.newsKeywordMatch.deleteMany();
  await prisma.searchJob.deleteMany();
  await prisma.newsItem.deleteMany();
  await prisma.keyword.deleteMany();

  const [marinha, forcasArmadas, ministerioDefesa, exercicioConjunto] =
    await Promise.all([
      prisma.keyword.create({
        data: { termo: "Marinha do Brasil", ativo: true, intervaloMinutos: 30 },
      }),
      prisma.keyword.create({
        data: { termo: "Forças Armadas", ativo: true, intervaloMinutos: 60 },
      }),
      prisma.keyword.create({
        data: { termo: "Ministério da Defesa", ativo: true, intervaloMinutos: 120 },
      }),
      prisma.keyword.create({
        data: {
          termo: "Exercício conjunto Brasil-EUA",
          ativo: false,
          intervaloMinutos: 60,
        },
      }),
    ]);

  const jobMarinhaConcluido = await prisma.searchJob.create({
    data: {
      keywordId: marinha.id,
      status: "concluido",
      origem: "agendado",
      startedAt: hoursAgo(2),
      finishedAt: hoursAgo(2),
    },
  });

  const jobForcasArmadasConcluido = await prisma.searchJob.create({
    data: {
      keywordId: forcasArmadas.id,
      status: "concluido",
      origem: "agendado",
      startedAt: hoursAgo(1),
      finishedAt: hoursAgo(1),
    },
  });

  const jobDefesaConcluidoAntigo = await prisma.searchJob.create({
    data: {
      keywordId: ministerioDefesa.id,
      status: "concluido",
      origem: "agendado",
      startedAt: hoursAgo(3),
      finishedAt: hoursAgo(3),
    },
  });

  await prisma.searchJob.create({
    data: {
      keywordId: ministerioDefesa.id,
      status: "erro",
      origem: "agendado",
      startedAt: minutesAgo(10),
      finishedAt: minutesAgo(9),
      erroMsg: "Timeout ao acessar fonte de notícias",
    },
  });

  await prisma.searchJob.create({
    data: {
      keywordId: marinha.id,
      status: "rodando",
      origem: "manual",
      startedAt: minutesAgo(1),
    },
  });

  const jobExercicioConjuntoConcluido = await prisma.searchJob.create({
    data: {
      keywordId: exercicioConjunto.id,
      status: "concluido",
      origem: "agendado",
      startedAt: daysAgo(5),
      finishedAt: daysAgo(5),
    },
  });

  const marinhaExercicio = await prisma.newsItem.create({
    data: {
      titulo: "Marinha do Brasil realiza exercício conjunto no Atlântico Sul",
      url: "https://g1.globo.com/marinha-exercicio-atlantico-sul",
      fonte: "g1.globo.com",
      resumo:
        "A Marinha do Brasil conduziu um exercício conjunto com forças aliadas no Atlântico Sul, com foco em operações de patrulha e resposta a incidentes marítimos.",
      relevancia: 0.87,
      dataPublicacaoOriginal: hoursAgo(2),
      fetchedAt: hoursAgo(2),
    },
  });

  const forcasArmadasHaiti = await prisma.newsItem.create({
    data: {
      titulo: "Forças Armadas participam de operação humanitária no Haiti",
      url: "https://noticias.uol.com.br/forcas-armadas-operacao-haiti",
      fonte: "uol.com.br",
      resumo:
        "Contingente das Forças Armadas brasileiras integra missão humanitária no Haiti, prestando apoio logístico e médico à população local.",
      relevancia: 0.72,
      dataPublicacaoOriginal: hoursAgo(1),
      fetchedAt: hoursAgo(1),
    },
  });

  const ministerioInvestimento = await prisma.newsItem.create({
    data: {
      titulo: "Ministério da Defesa anuncia novo investimento em tecnologia militar",
      url: "https://www.gov.br/defesa/pt-br/noticia-investimento-tecnologia",
      fonte: "gov.br",
      resumo:
        "O Ministério da Defesa anunciou um pacote de investimentos voltado à modernização tecnológica das Forças Armadas nos próximos cinco anos.",
      relevancia: 0.65,
      dataPublicacaoOriginal: hoursAgo(3),
      fetchedAt: hoursAgo(3),
    },
  });

  const parceriaModernizacaoFrota = await prisma.newsItem.create({
    data: {
      titulo: "Governo detalha parceria estratégica com a Marinha para modernização de frota",
      url: "https://agenciabrasil.ebc.com.br/parceria-marinha-modernizacao-frota",
      fonte: "agenciabrasil.ebc.com.br",
      resumo:
        "Acordo prevê a renovação de embarcações e sistemas de navegação da Marinha do Brasil ao longo da próxima década.",
      relevancia: 0.58,
      dataPublicacaoOriginal: hoursAgo(4),
      fetchedAt: hoursAgo(4),
    },
  });

  const exercicioBrasilEua = await prisma.newsItem.create({
    data: {
      titulo: "Brasil e EUA concluem exercício militar conjunto",
      url: "https://www.defesanet.com.br/brasil-eua-exercicio-conjunto",
      fonte: "defesanet.com.br",
      resumo:
        "Forças armadas do Brasil e dos Estados Unidos encerraram uma semana de treinamento conjunto com foco em operações de defesa territorial.",
      relevancia: 0.5,
      dataPublicacaoOriginal: daysAgo(5),
      fetchedAt: daysAgo(5),
    },
  });

  // Notícia que satisfaz duas keywords em buscas distintas — caso central da
  // tabela associativa news_keyword_matches (ver docs/CONTRATO.md).
  await prisma.newsKeywordMatch.createMany({
    data: [
      {
        newsItemId: marinhaExercicio.id,
        keywordId: marinha.id,
        jobId: jobMarinhaConcluido.id,
      },
      {
        newsItemId: marinhaExercicio.id,
        keywordId: forcasArmadas.id,
        jobId: jobForcasArmadasConcluido.id,
      },
      {
        newsItemId: forcasArmadasHaiti.id,
        keywordId: forcasArmadas.id,
        jobId: jobForcasArmadasConcluido.id,
      },
      {
        newsItemId: ministerioInvestimento.id,
        keywordId: ministerioDefesa.id,
        jobId: jobDefesaConcluidoAntigo.id,
      },
      {
        newsItemId: parceriaModernizacaoFrota.id,
        keywordId: marinha.id,
        jobId: jobMarinhaConcluido.id,
      },
      {
        newsItemId: exercicioBrasilEua.id,
        keywordId: exercicioConjunto.id,
        jobId: jobExercicioConjuntoConcluido.id,
      },
    ],
  });

  console.log("Seed concluído.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
